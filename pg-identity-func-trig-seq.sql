SET search_path TO common_oltp;

CREATE TABLE
    pgifx_sync_audit
    (
        seq_id SERIAL NOT NULL,
        payloadseqid CHARACTER VARYING,
        processid INTEGER,
        tablename CHARACTER VARYING(64),
        uniquecolumn CHARACTER VARYING(64),
        dboperation CHARACTER VARYING(32),
        syncstatus CHARACTER VARYING(64),
        retrycount CHARACTER VARYING(64),
        consumer_err CHARACTER VARYING,
        producer_err CHARACTER VARYING,
        payload CHARACTER VARYING,
        auditdatetime TIMESTAMP(6) WITHOUT TIME ZONE,
        topicname CHARACTER VARYING(64),
        UNIQUE (payloadseqid)
    );

CREATE OR REPLACE FUNCTION "common_oltp"."notify_trigger_common_oltp" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
  rec RECORD;
  payload TEXT;
  column_name TEXT;
  column_value TEXT;
  pguserval TEXT;
  payload_items TEXT[];
  uniquecolumn TEXT;
  logtime TEXT;
  payloadseqid INTEGER;
BEGIN


--pguserval := (SELECT 1 FROM pg_roles WHERE rolname = 'pgsyncuser');
pguserval := (SELECT current_user);
 if pguserval = 'pgsyncuser' then
    RAISE notice 'pgsyncuser name : %', pguserval;
   
    CASE TG_OP
    WHEN 'INSERT', 'UPDATE' THEN
     rec := NEW;
     WHEN 'DELETE' THEN
     rec := OLD;
     ELSE
     RAISE EXCEPTION 'Unknown TG_OP: "%". Should not occur!', TG_OP;
    END CASE;
    return rec;
   end if;
 
  CASE TG_OP
  WHEN 'INSERT', 'UPDATE' THEN
     rec := NEW;
  WHEN 'DELETE' THEN
     rec := OLD;
  ELSE
     RAISE EXCEPTION 'Unknown TG_OP: "%". Should not occur!', TG_OP;
  END CASE;
 raise notice 'table name : %', TG_TABLE_NAME;
   RAISE info 'hello world';
  -- Get required fields
  FOREACH column_name IN ARRAY TG_ARGV LOOP
    EXECUTE format('SELECT $1.%I::TEXT', column_name)
    INTO column_value
    USING rec;
   case 
    when 
    column_name = 'upload_document' then 
         --  RAISE NOTICE 'upload_document boolean';
         if column_value = 'false' then
                column_value = '0';
        else
                column_value = '1';
        end if;
    when
    column_name = 'upload_document_required' then
         -- RAISE NOTICE 'upload_document_required boolean';
        if column_value = 'false' then
                column_value = '0';
        else
                column_value = '1';     
        end if;
     when
        column_name = 'identify_email_enabled' then
        if column_value = 'false' then
                column_value = '0';
        else
                column_value = '1';     
        end if;
     when
        column_name = 'identify_handle_enabled' then
        if column_value = 'false' then
                column_value = '0';
        else
                column_value = '1';     
        end if;
      when  
     column_name = 'create_date' then 
      column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
      when
         column_name = 'modify_date' then 
       column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
     -- when
      --   column_name = 'achievement_date' then 
      --column_value := (select to_date (column_value, 'MM/DD/YYYY'));
      --column_value := (select to_date (column_value));
       --when
         --column_name = 'password' then 
         --column_value := regexp_replace(column_value, '\s', '', 'g');
         --column_value := regexp_replace(column_value, E'[\\n\\r]+', '\n\r', 'g');  
           else
    -- RAISE NOTICE ' not boolean';
    end case;
    payload_items := array_append(payload_items, '"' || replace(column_name, '"', '\"') || '":"' || replace(column_value, '"', '\"') || '"');
  END LOOP;
  --logtime := (select date_display_tz());
  logtime := (SELECT to_char (now()::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));

  payloadseqid := (select nextval('payloadsequence'::regclass));

  uniquecolumn := (SELECT c.column_name
        FROM information_schema.key_column_usage AS c
        LEFT JOIN information_schema.table_constraints AS t
        ON t.constraint_name = c.constraint_name
        WHERE t.table_name = TG_TABLE_NAME AND t.constraint_type = 'PRIMARY KEY' limit 1);
        
        if (uniquecolumn = '') IS NOT FALSE then
         uniquecolumn := 'Not-Available';
         end if;

  -- Build the payload
  payload := ''
               || '{'
              || '"topic":"' || 'test.db.postgres.sync' || '",'
              || '"originator":"' || 'tc-postgres-delta-processor' || '",'  
            || '"timestamp":"' || logtime  || '",'
              || '"mime-type":"' || 'application/json'                   || '",'
              || '"payload": {'      
              || '"payloadseqid":"' || payloadseqid                   || '",'
              || '"Uniquecolumn":"' || uniquecolumn                   || '",'
              || '"operation":"' || TG_OP                                || '",'
              || '"schema":"'    || TG_TABLE_SCHEMA                      || '",'
              || '"table":"'     || TG_TABLE_NAME                        || '",'
              || '"data": {'      || array_to_string(payload_items, ',')  || '}'
              || '}}';

  -- Notify the channel
  PERFORM pg_notify('test_db_notifications', payload);
  
  RETURN rec;

END;
$body$ LANGUAGE plpgsql
                                  
CREATE TRIGGER "pg_email_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON email
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('user_id', 'email_id', 'email_type_id', 'address', 'primary_ind', 'status_id');

CREATE TRIGGER "pg_security_user_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON security_user
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('login_id', 'user_id', 'password', 'create_user_id');


CREATE TRIGGER "pg_user_achievement_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON user_achievement
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('user_id', 'achievement_date', 'achievement_type_id', 'description', 'create_date');

CREATE TRIGGER "pg_user_group_xref_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON user_group_xref
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('user_group_id', 'login_id', 'group_id', 'create_user_id', 'security_status_id');

CREATE TRIGGER "pg_user_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON "user"
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('user_id', 'first_name', 'last_name', 'handle', 'status', 'activation_code', 'reg_source', 'utm_source', 'utm_medium', 'utm_campaign');
                                  
 CREATE TRIGGER "pg_user_sso_login_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON user_sso_login
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('user_id', 'sso_user_id', 'sso_user_name', 'provider_id', 'email');
                                  
CREATE TRIGGER "pg_user_social_login_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON user_social_login
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('social_user_id', 'user_id', 'social_login_provider_id', 'social_user_name', 'social_email', 'social_email_verified');
                                  
CREATE TRIGGER "pg_security_groups_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON security_groups
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('group_id', 'description', 'challenge_group_ind', 'create_user_id');

                                

                                
  CREATE SEQUENCE payloadsequence INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 
START WITH 1  NO CYCLE;
                                  
--drop sequence sequence_user_seq;                              
CREATE SEQUENCE sequence_user_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH
110100000 NO CYCLE;
                                  
--drop SEQUENCE sequence_user_group_seq;
CREATE SEQUENCE sequence_user_group_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START
WITH 601000000 NO CYCLE;


--drop SEQUENCE sequence_email_seq;
CREATE SEQUENCE sequence_email_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START
WITH 70100000 NO CYCLE;

 ---COUNTRY TABLE ADDITIONAL COLUMN
  alter table country 
  ADD COLUMN iso_name VARCHAR(128),
  ADD COLUMN iso_alpha2_code VARCHAR(2),
  ADD COLUMN iso_alpha3_code VARCHAR(3);
  --migrate directly from dev/prod database (using ecs run migrator).
                                  
 --migrate directly from dev/prod database (using ecs run migrator).
 ALTER TABLE sso_login_provider 
 ADD COLUMN identify_email_enabled BOOLEAN NOT NULL default true,
 ADD COLUMN identify_handle_enabled BOOLEAN NOT NULL default true;                                  

SET search_path TO informixoltp;

CREATE OR REPLACE FUNCTION "informixoltp"."notify_trigger_informixoltp" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
  rec RECORD;
  payload TEXT;
  column_name TEXT;
  column_value TEXT;
  payload_items TEXT[];
  pguserval TEXT;
  uniquecolumn TEXT;
  logtime TEXT;
  payloadseqid INTEGER;
BEGIN
                                  
 pguserval := (SELECT current_user);
 if pguserval = 'pgsyncuser' then
    RAISE notice 'pgsyncuser name : %', pguserval;
   
    CASE TG_OP
    WHEN 'INSERT', 'UPDATE' THEN
     rec := NEW;
     WHEN 'DELETE' THEN
     rec := OLD;
     ELSE
     RAISE EXCEPTION 'Unknown TG_OP: "%". Should not occur!', TG_OP;
    END CASE;
    return rec;
   end if;
   
  CASE TG_OP
  WHEN 'INSERT', 'UPDATE' THEN
     rec := NEW;
  WHEN 'DELETE' THEN
     rec := OLD;
  ELSE
     RAISE EXCEPTION 'Unknown TG_OP: "%". Should not occur!', TG_OP;
  END CASE;
 raise notice 'table name : %', TG_TABLE_NAME;
   RAISE info 'hello world';
  -- Get required fields
  FOREACH column_name IN ARRAY TG_ARGV LOOP
    EXECUTE format('SELECT $1.%I::TEXT', column_name)
    INTO column_value
    USING rec;
   case 
    when 
    column_name = 'upload_document' then 
         --  RAISE NOTICE 'upload_document boolean';
         if column_value = 'false' then
                column_value = '0';
        else
                column_value = '1';
        end if;
    when
    column_name = 'upload_document_required' then
         -- RAISE NOTICE 'upload_document_required boolean';
        if column_value = 'false' then
                column_value = '0';
        else
                column_value = '1';     
        end if;
     when
        column_name = 'identify_email_enabled' then
        if column_value = 'false' then
                column_value = '0';
        else
                column_value = '1';     
        end if;
     when
        column_name = 'identify_handle_enabled' then
        if column_value = 'false' then
                column_value = '0';
        else
                column_value = '1';     
        end if;
      when  
     column_name = 'create_date' then 
      column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
      when
         column_name = 'modify_date' then 
       column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
     -- when
      --   column_name = 'achievement_date' then 
      --column_value := (select to_date (column_value, 'MM/DD/YYYY'));
      --column_value := (select to_date (column_value));
       --when
         --column_name = 'password' then 
         --column_value := regexp_replace(column_value, '\s', '', 'g');
         --column_value := regexp_replace(column_value, E'[\\n\\r]+', '\n\r', 'g');  
           else
    -- RAISE NOTICE ' not boolean';
    end case;
    payload_items := array_append(payload_items, '"' || replace(column_name, '"', '\"') || '":"' || replace(column_value, '"', '\"') || '"');
  END LOOP;
  --logtime := (select date_display_tz());
  logtime := (SELECT to_char (now()::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  payloadseqid := (select nextval('payloadsequence'::regclass));

  uniquecolumn := (SELECT c.column_name
        FROM information_schema.key_column_usage AS c
        LEFT JOIN information_schema.table_constraints AS t
        ON t.constraint_name = c.constraint_name
        WHERE t.table_name = TG_TABLE_NAME AND t.constraint_type = 'PRIMARY KEY' LIMIT 1);
        
        if (uniquecolumn = '') IS NOT FALSE then
         uniquecolumn := 'Not-Available';
         end if;

  -- Build the payload
  payload := ''
               || '{'
              || '"topic":"' || 'test.db.postgres.sync' || '",'
              || '"originator":"' || 'tc-postgres-delta-processor' || '",'  
            || '"timestamp":"' || logtime  || '",'
              || '"mime-type":"' || 'application/json'                   || '",'
              || '"payload": {'      
              || '"payloadseqid":"' || payloadseqid                   || '",'
              || '"Uniquecolumn":"' || uniquecolumn                   || '",'
              || '"operation":"' || TG_OP                                || '",'
              || '"schema":"'    || TG_TABLE_SCHEMA                      || '",'
              || '"table":"'     || TG_TABLE_NAME                        || '",'
              || '"data": {'      || array_to_string(payload_items, ',')  || '}'
              || '}}';

  -- Notify the channel
  PERFORM pg_notify('test_db_notifications', payload);
  
  RETURN rec;
END;
$body$ LANGUAGE plpgsql;


CREATE TRIGGER "pg_algo_rating"
  AFTER INSERT OR DELETE OR UPDATE ON algo_rating
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_informixoltp('coder_id', 'rating', 'vol', 'round_id', 'num_ratings', 'algo_rating_type_id', 'modify_date');

CREATE TRIGGER "pg_coder"
  AFTER INSERT OR DELETE OR UPDATE ON coder
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_informixoltp('coder_id', 'quote', 'coder_type_id', 'comp_country_code', 'display_quote', 'quote_location', 'quote_color', 'display_banner', 'banner_style');

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA common_oltp,informixoltp, corporate_oltp,tcs_catalog, time_oltp TO coder;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA common_oltp,informixoltp, corporate_oltp,tcs_catalog, time_oltp TO coder;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA common_oltp,informixoltp, corporate_oltp,tcs_catalog, time_oltp TO pgsyncuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA common_oltp,informixoltp, corporate_oltp,tcs_catalog, time_oltp TO pgsyncuser;
grant USAGE ON  SCHEMA common_oltp,informixoltp, corporate_oltp,tcs_catalog, time_oltp To pgsyncuser;
grant USAGE ON  SCHEMA common_oltp,informixoltp, corporate_oltp,tcs_catalog, time_oltp To coder;;
