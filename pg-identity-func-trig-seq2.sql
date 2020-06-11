SET search_path TO common_oltp;

CREATE INDEX IF NOT EXISTS email_address_idx ON common_oltp.email
    (
    address 
    );
    
CREATE INDEX IF NOT EXISTS user_activ_code_idx ON common_oltp.user
    (
    activation_code 
    );

CREATE INDEX IF NOT EXISTS user_open_id_idx ON common_oltp.user
    (
    open_id
    );

CREATE INDEX IF NOT EXISTS user_status_idx ON common_oltp.user
    (
    status
    );


CREATE TABLE sync_test_id
(
        uniqid INTEGER NOT NULL,
        description varchar(200),
        created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
        PRIMARY KEY (uniqid)
    );
CREATE TRIGGER "pg_sync_test_id_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON sync_test_id
  FOR EACH ROW
EXECUTE PROCEDURE common_oltp.notify_trigger_common_oltp('uniqid', 'description', 'created_at');

ALTER TABLE "common_oltp"."sync_test_id" disable TRIGGER "pg_sync_test_id_trigger"

CREATE OR REPLACE FUNCTION "common_oltp"."notify_trigger_common_oltp" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
  rec RECORD;
  payload TEXT;
  column_name TEXT;
  column_value TEXT;
  pguserval TEXT;
 --payload_items TEXT[];
  payload_items JSONB;
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
   -- else
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
        column_name = 'social_email_verified' then
        if column_value = 'false' then
                column_value = 'f';
        else
                column_value = 't';     
        end if;
      when  
        column_name = 'create_date' then 
        column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
      when
         column_name = 'modify_date' then 
         column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
      when
         column_name = 'last_login' then 
         column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
      when
         column_name = 'last_site_hit_date' then 
         column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
      when
         column_name = 'corona_event_timestamp' then 
         column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
      when
         column_name = 'created_at' then 
         column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
      else
    -- RAISE NOTICE ' not boolean';
    end case;
   --payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,column_value)::jsonb;
   payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,replace(column_value,'"','\"'))::jsonb;
   -- payload_items := array_append(payload_items, '"' || replace(column_name, '"', '\"') || '":"' || replace(column_value, '"', '\"') || '"');
  END LOOP;
  --logtime := (select date_display_tz());
  logtime := (SELECT to_char (now()::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  payloadseqid := (select nextval('common_oltp.payloadsequence'::regclass));

  uniquecolumn := (SELECT c.column_name
        FROM information_schema.key_column_usage AS c
        LEFT JOIN information_schema.table_constraints AS t
        ON t.constraint_name = c.constraint_name
        WHERE t.table_name = TG_TABLE_NAME AND t.constraint_type = 'PRIMARY KEY' LIMIT 1);
        
        if (uniquecolumn = '') IS NOT FALSE then
         uniquecolumn := 'Not-Available';
         end if;
         
    -- exclude any null value columns.
  payload_items := jsonb_strip_nulls(payload_items);

  -- Build the payload
  payload := ''
               || '{'
              || '"topic":"' || 'dev.db.postgres.sync' || '",'
              || '"originator":"' || 'tc-postgres-delta-processor' || '",'  
            || '"timestamp":"' || logtime  || '",'
              || '"mime-type":"' || 'application/json'                   || '",'
              || '"payload": {'      
              || '"payloadseqid":"' || payloadseqid                   || '",'
              || '"Uniquecolumn":"' || uniquecolumn                   || '",'
              || '"operation":"' || TG_OP                                || '",'
              || '"schema":"'    || TG_TABLE_SCHEMA                      || '",'
              || '"table":"'     || TG_TABLE_NAME                        || '",'
              || '"data": '    || payload_items
              || '}}';
  -- Notify the channel
  PERFORM pg_notify('dev_db_notifications', payload);
  RETURN rec;
END;
$body$ LANGUAGE plpgsql

CREATE OR REPLACE FUNCTION "common_oltp"."proc_email_update" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
pguserval TEXT;
BEGIN 
 pguserval := (SELECT current_user);
 if pguserval != 'pgsyncuser' then
      if (OLD.email_type_id != NEW.email_type_id) then 
         insert into common_oltp.audit_user (column_name, old_value, new_value, user_id)
         values ('EMAIL_TYPE', OLD.email_type_id, NEW.email_type_id, OLD.user_id);
      End If;

      if (OLD.status_id != NEW.status_id) then 
         insert into common_oltp.audit_user (column_name, old_value, new_value, user_id)
         values ('EMAIL_STATUS', OLD.status_id, NEW.status_id, OLD.user_id);
      End If;

      if (OLD.address != NEW.address) then 
         insert into common_oltp.audit_user (column_name, old_value, new_value, user_id)
         values ('EMAIL_ADDRESS', OLD.address, NEW.address, OLD.user_id);
      End If;

      if (OLD.primary_ind != NEW.primary_ind) then 
         insert into common_oltp.audit_user (column_name, old_value, new_value, user_id)
         values ('EMAIL_PRIMARY_IND', OLD.primary_ind, NEW.primary_ind, OLD.user_id);
      End If;

      --  if pguserval != 'pgsyncuser' then
         NEW.modify_date = current_timestamp;
        end if;
      
      
      RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "common_oltp"."proc_phone_update" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
pguserval TEXT;
BEGIN 
pguserval := (SELECT current_user);
if pguserval != 'pgsyncuser' then
      if (OLD.phone_type_id != NEW.phone_type_id) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('PHONE_TYPE', OLD.phone_type_id, NEW.phone_type_id, OLD.user_id);
      End If;

      if (OLD.phone_number != NEW.phone_number) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('PHONE_NUMBER', OLD.phone_number, NEW.phone_number, OLD.user_id);
      End If;

      if (OLD.primary_ind != NEW.primary_ind) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('PHONE_PRIMARY_IND', OLD.primary_ind, NEW.primary_ind, OLD.user_id);
      End If;
     
      NEW.modify_date = current_timestamp;
      end if;
      RETURN NEW;
END;
$body$ LANGUAGE plpgsql

CREATE OR REPLACE FUNCTION "common_oltp"."proc_user_update" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
pguserval TEXT;
BEGIN
pguserval := (SELECT current_user);
if pguserval != 'pgsyncuser' then
      IF (TG_OP = 'UPDATE') THEN
              if ((OLD.first_name != NEW.first_name) or (OLD.last_name != NEW.last_name ) or (OLD.middle_name != NEW.middle_name )) then
                 insert into common_oltp.audit_user (column_name, old_value, new_value, user_id)
                 values ('NAME', NULLIF(OLD.first_name, '') || ' ' || NULLIF(OLD.middle_name, '') || ' ' || NULLIF(OLD.last_name, ''),
                         NULLIF(NEW.first_name, '') || ' ' || NULLIF(NEW.middle_name, '') || ' ' || NULLIF(NEW.last_name, ''), OLD.user_id);
              End if;
              
              if (OLD.handle != NEW.handle) then 
                 insert into common_oltp.audit_user (column_name, old_value, new_value, user_id)
                 values ('HANDLE', OLD.handle, NEW.handle, OLD.user_id);
              End If;
        
              if (OLD.status != NEW.status) then 
                 insert into common_oltp.audit_user (column_name, old_value, new_value, user_id)
                 values ('STATUS', OLD.status, NEW.status, OLD.user_id);
              End If;
        
              if (OLD.activation_code != NEW.activation_code) then 
                 insert into common_oltp.audit_user (column_name, old_value, new_value, user_id)
                 values ('ACTIVATION_CODE', OLD.activation_code, NEW.activation_code, OLD.user_id);
              End If;
        
              if (OLD.timezone_id != NEW.timezone_id) then 
                 insert into common_oltp.audit_user (column_name, old_value, new_value, user_id)
                 values ('TIMEZONE_ID', OLD.timezone_id, NEW.timezone_id, OLD.user_id);
              End If;
        
         
                NEW.modify_date = current_timestamp;
         end if;
              
              
       END IF;

      NEW.handle_lower = lower(NEW.handle);
      
      RETURN NEW;
END;
$body$ LANGUAGE plpgsql

CREATE OR REPLACE FUNCTION "common_oltp"."proc_address_update" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE 
pguserval TEXT;
 user_id DECIMAL(10,0);
BEGIN
      user_id := NULLIF((select min(x.user_id) from user_address_xref x where x.address_id = OLD.address_id), -1);
       pguserval := (SELECT current_user);
 if pguserval != 'pgsyncuser' then       
      if (user_id > 0 and OLD.address1 != NEW.address1) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('ADDRESS1', OLD.address1, NEW.address1, user_id);
      End If;

      if (user_id > 0 and OLD.address2 != NEW.address2) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('ADDRESS2', OLD.address2, NEW.address2, user_id);
      End If;

      if (user_id > 0 and OLD.address3 != NEW.address3) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('ADDRESS3', OLD.address3, NEW.address3, user_id);
      End If;

      if (user_id > 0 and OLD.city != NEW.city) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('ADDRESS_CITY', OLD.city, NEW.city, user_id);
      End If;

      if (user_id > 0 and OLD.state_code != NEW.state_code) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('ADDRESS_STATE', OLD.state_code, NEW.state_code, user_id);
      End If;

      if (user_id > 0 and OLD.province != NEW.province) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('ADDRESS_PROVINCE', OLD.province, NEW.province, user_id);
      End If;

      if (user_id > 0 and OLD.zip != NEW.zip) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('ADDRESS_ZIP', OLD.zip, NEW.zip, user_id);
      End If;
      
      if (user_id > 0 and OLD.country_code != NEW.country_code) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('ADDRESS_COUNTRY', OLD.country_code, NEW.country_code, user_id);
      End If;

      NEW.modify_date = current_timestamp;
      end if;
      RETURN NEW;
END;
$body$ LANGUAGE plpgsql


CREATE OR REPLACE FUNCTION "common_oltp"."proc_user_last_login" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
pguserval TEXT;
BEGIN
pguserval := (SELECT current_user);
 if pguserval != 'pgsyncuser' then
      if (OLD.last_login != NEW.last_login) then
          insert into common_oltp.corona_event(corona_event_type_id, user_id, corona_event_timestamp)
         values (1, OLD.user_id, NEW.last_login);
          end if;
      end if;
      
      RETURN NULL;
END;
$body$ LANGUAGE plpgsql


CREATE TRIGGER "pg_security_groups_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON security_groups
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('group_id', 'description', 'challenge_group_ind', 'create_user_id');

 CREATE TRIGGER "pg_social_login_provider_trigger"
AFTER INSERT OR DELETE OR UPDATE ON social_login_provider
FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('social_login_provider_id', 'name');


CREATE TRIGGER "pg_sso_login_provider_trigger"
AFTER INSERT OR DELETE OR UPDATE ON sso_login_provider
FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('sso_login_provider_id', 'name','type','identify_email_enabled','identify_handle_enabled');

CREATE TRIGGER "pg_Country_trigger"
AFTER INSERT OR DELETE OR UPDATE ON Country
FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('country_code', 'country_name','modify_date','participating','default_taxform_id','longitude','latitude','region','iso_name','iso_alpha2_code','iso_alpha3_code');

CREATE TRIGGER "pg_invalid_handles_trigger"
AFTER INSERT OR DELETE OR UPDATE ON invalid_handles
FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('invalid_handle_id', 'invalid_handle');

CREATE TRIGGER "pg_achievement_type_lu_trigger"
AFTER INSERT OR DELETE OR UPDATE ON achievement_type_lu
FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_common_oltp('achievement_type_id','achievement_type_desc');



ALTER TABLE "user" DISABLE TRIGGER pg_user_trigger;
ALTER TABLE email DISABLE TRIGGER pg_email_trigger;
ALTER TABLE security_user DISABLE TRIGGER pg_security_user_trigger;
ALTER TABLE user_sso_login DISABLE TRIGGER pg_user_sso_login_trigger;
ALTER TABLE user_achievement DISABLE TRIGGER pg_user_achievement_trigger;
ALTER TABLE user_group_xref DISABLE TRIGGER pg_user_group_xref_trigger;
ALTER TABLE security_groups DISABLE TRIGGER pg_security_groups_trigger;
ALTER TABLE user_social_login DISABLE TRIGGER pg_user_social_login_trigger;
ALTER TABLE social_login_provider DISABLE TRIGGER pg_social_login_provider_trigger;
ALTER TABLE sso_login_provider DISABLE TRIGGER pg_sso_login_provider_trigger;
ALTER TABLE country DISABLE TRIGGER pg_country_trigger;
ALTER TABLE invalid_handles DISABLE TRIGGER pg_invalid_handles_trigger;
ALTER TABLE achievement_type_lu DISABLE TRIGGER pg_achievement_type_lu_trigger;
ALTER TABLE corana_event DISABLE TRIGGER pg_corana_event_trigger;
ALTER TABLE audit_user DISABLE TRIGGER pg_audit_user_trigger;

DROP sequence "common_oltp"."sequence_user_group_seq";
CREATE SEQUENCE sequence_user_group_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
START WITH 951000000 NO CYCLE;

DROP sequence "common_oltp"."sequence_user_seq";
CREATE SEQUENCE sequence_user_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH
488770000 NO CYCLE;

ALTER SEQUENCE corona_event_corona_event_id_seq RESTART WITH 577770000;

SET search_path TO informixoltp;

CREATE OR REPLACE FUNCTION "informixoltp"."notify_trigger_informixoltp" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
  rec RECORD;
  payload TEXT;
  column_name TEXT;
  column_value TEXT;
 -- payload_items TEXT[];
    payload_items JSONB;
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
   -- else
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
 --  RAISE info 'hello world';
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
       when
         column_name = 'member_since' then 
       column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));   
       else
    -- RAISE NOTICE ' not boolean';
    end case;
  --  payload_items := array_append(payload_items, '"' || replace(column_name, '"', '\"') || '":"' || replace(column_value, '"', '\"') || '"');
    --payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,column_value)::jsonb;
    payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,replace(column_value,'"','\"'))::jsonb;
  END LOOP;
  logtime := (SELECT to_char (now()::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  payloadseqid := (select nextval('common_oltp.payloadsequence'::regclass));

  uniquecolumn := (SELECT c.column_name
        FROM information_schema.key_column_usage AS c
        LEFT JOIN information_schema.table_constraints AS t
        ON t.constraint_name = c.constraint_name
        WHERE t.table_name = TG_TABLE_NAME AND t.constraint_type = 'PRIMARY KEY' LIMIT 1);
        
        if (uniquecolumn = '') IS NOT FALSE then
         uniquecolumn := 'Not-Available';
         end if;
         
     -- exclude any null value columns.
  payload_items := jsonb_strip_nulls(payload_items);

  -- Build the payload
  payload := ''
               || '{'
              || '"topic":"' || 'dev.db.postgres.sync' || '",'
              || '"originator":"' || 'tc-postgres-delta-processor' || '",'  
            || '"timestamp":"' || logtime  || '",'
              || '"mime-type":"' || 'application/json'                   || '",'
              || '"payload": {'      
              || '"payloadseqid":"' || payloadseqid                   || '",'
              || '"Uniquecolumn":"' || uniquecolumn                   || '",'
              || '"operation":"' || TG_OP                                || '",'
              || '"schema":"'    || TG_TABLE_SCHEMA                      || '",'
              || '"table":"'     || TG_TABLE_NAME                        || '",'
               || '"data": '    || payload_items
              || '}}';

  -- Notify the channel
  PERFORM pg_notify('dev_db_notifications', payload);
  
  RETURN rec;
END;
$body$ LANGUAGE plpgsql

CREATE OR REPLACE FUNCTION "informixoltp"."proc_coder_update" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
  pguserval TEXT;
begin
    if (OLD.quote != NEW.quote) then
     insert into audit_coder (column_name, old_value, new_value, user_id)
     values ('QUOTE', OLD.quote , NEW.quote, OLD.coder_id);
    end if;

    if (OLD.coder_type_id != NEW.coder_type_id) then
     insert into audit_coder (column_name, old_value, new_value, user_id)
     values ('CODER_TYPE', OLD.coder_type_id , NEW.coder_type_id, OLD.coder_id);
    end if;
    if (OLD.language_id != NEW.language_id) then
     insert into audit_coder (column_name, old_value, new_value, user_id)
     values ('LANGUAGE', OLD.language_id , NEW.language_id, OLD.coder_id);
    end if;
    if (OLD.comp_country_code != NEW.comp_country_code) then
     insert into audit_coder (column_name, old_value, new_value, user_id)
     values ('COMP_COUNTRY', OLD.comp_country_code , NEW.comp_country_code, OLD.coder_id);
    end if;
       pguserval := (SELECT current_user);
       if pguserval != 'pgsyncuser' then
     --  RAISE info 'current_user';
      -- raise notice 'inside current_user  : %', current_user;
        --update coder set modify_date = current_timestamp where coder_id = OLD.coder_id;
        NEW.modify_date = current_timestamp;
        end if;
        
    return NEW;
end ;
$body$ LANGUAGE plpgsql


CREATE TRIGGER "pg_coder_referral_trigger"
AFTER INSERT OR DELETE OR UPDATE ON coder_referral
FOR EACH ROW
EXECUTE PROCEDURE notify_trigger_informixoltp('coder_id', 'referral_id','reference_id','other');

ALTER TABLE coder DISABLE TRIGGER pg_coder;
ALTER TABLE algo_rating DISABLE TRIGGER pg_algo_rating;
ALTER TABLE coder_referral DISABLE TRIGGER pg_coder_referral_trigger;

SET search_path TO tcs_catalog;

CREATE OR REPLACE FUNCTION "tcs_catalog"."notify_trigger" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
  rec RECORD;
  payload TEXT;
  column_name TEXT;
  column_value TEXT;
  --payload_items TEXT[];
   payload_items JSONB;
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
   -- else
   end if;
   
  -- Set record row depending on operation
  CASE TG_OP
  WHEN 'INSERT', 'UPDATE' THEN
     rec := NEW;
  WHEN 'DELETE' THEN
     rec := OLD;
  ELSE
     RAISE EXCEPTION 'Unknown TG_OP: "%". Should not occur!', TG_OP;
  END CASE; 
  -- Get required fields
  FOREACH column_name IN ARRAY TG_ARGV LOOP
    EXECUTE format('SELECT $1.%I::TEXT', column_name)
    INTO column_value
    USING rec;
   case 
    when 
    column_name = 'upload_document' then 
         if column_value = 'false' then
                column_value = '0';
        else
                column_value = '1';       
        end if;
    when
    column_name = 'upload_document_required' then
        if column_value = 'false' then
                column_value = '0';
        else
                column_value = '1';     
        end if;
    else
    -- RAISE NOTICE ' not boolean';
    end case;
    --payload_items := array_append(payload_items, '"' || replace(column_name, '"', '\"') || '":"' || replace(column_value, '"', '\"') || '"');
    --payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,column_value)::jsonb;
    payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,replace(column_value,'"','\"'))::jsonb;
   
   END LOOP;
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
  -- exclude any null value columns.
  payload_items := jsonb_strip_nulls(payload_items);

  RAISE Notice ' payload val: "%"', payload;
  -- Build the payload
  --payload := ''
  --            || '{'
  --            || '"topic":"' || 'dev.db.postgres.sync' || '",'
  --            || '"originator":"' || 'tc-postgres-delta-processor' || '",'  
  --            || '"timestamp":"' || logtime  || '",'
  --            || '"mime-type":"' || 'application/json'                   || '",'
  --            || '"payload": {'      
  --            || '"payloadseqid":"' || payloadseqid                   || '",'
  --            || '"Uniquecolumn":"' || uniquecolumn                   || '",'
  --            || '"operation":"' || TG_OP                                || '",'
  --            || '"schema":"'    || TG_TABLE_SCHEMA                      || '",'
  --            || '"table":"'     || TG_TABLE_NAME                        || '",'
  --            || '"data": {'      || array_to_string(payload_items, ',')  || '}'
  --            || '}}';

  payload := ''
              || '{'
              || '"topic":"' || 'dev.db.postgres.sync' || '",'
              || '"originator":"' || 'tc-postgres-delta-processor' || '",'  
              || '"timestamp":"' || logtime  || '",'
              || '"mime-type":"' || 'application/json'                   || '",'
              || '"payload": {'      
              || '"payloadseqid":"' || payloadseqid                   || '",'
              || '"Uniquecolumn":"' || uniquecolumn                   || '",'
              || '"operation":"' || TG_OP                                || '",'
              || '"schema":"'    || TG_TABLE_SCHEMA                      || '",'
              || '"table":"'     || TG_TABLE_NAME                        || '",'
              || '"data":'       || payload_items  
             || '}}';
        
  -- Notify the channel
  PERFORM pg_notify('dev_db_notifications', payload);
  
  RETURN rec;
END;
$body$ LANGUAGE plpgsql;


GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA common_oltp,informixoltp,tcs_catalog TO pgsyncuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA common_oltp,informixoltp,tcs_catalog TO pgsyncuser;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA common_oltp,informixoltp,tcs_catalog TO coder;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA common_oltp,informixoltp,tcs_catalog TO coder;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA common_oltp,informixoltp,tcs_catalog TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA common_oltp,informixoltp,tcs_catalog TO postgres;

grant USAGE ON  SCHEMA common_oltp,informixoltp,tcs_catalog To pgsyncuser;
grant USAGE ON  SCHEMA common_oltp,informixoltp,tcs_catalog To coder;
grant USAGE ON  SCHEMA common_oltp,informixoltp,tcs_catalog To postgres;
