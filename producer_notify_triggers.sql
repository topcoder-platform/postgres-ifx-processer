CREATE OR REPLACE FUNCTION "tcs_catalog"."notify_trigger" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
  rec RECORD;
  payload TEXT;
 -- payload2 TEXT;
  column_name TEXT;
  column_value TEXT;
  --payload_items TEXT[];
  payload2 JSONB;
   payload_items JSONB;
   payload_items1 JSONB;
  pguserval TEXT;
  uniquecolumn TEXT;
  logtime TEXT;
  payloadseqid INTEGER;
    channelname TEXT;
  kafkatopicname TEXT;
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
  
   --channel and topic details
   RAISE notice ' % ',TG_TABLE_NAME; 
  SELECT channel, topic  into channelname, kafkatopicname from common_oltp.pgifx_tbl_channel_mapping where tablename = TG_TABLE_NAME limit 1;
  if (channelname = '') IS NOT FALSE then
          channelname = 'dev_db_notifications';
  RAISE info 'setting default dev_db_notifications';
  end if;
  RAISE info 'nofity_common_oltp_trigger';
  
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
        else
 --   column_value = regexp_replace(column_value, '^[\\r\\n\\t ]*|[\\r\\n\\t ]*$', '', 'g');
    end case;
    --payload_items := array_append(payload_items, '"' || replace(column_name, '"', '\"') || '":"' || replace(column_value, '"', '\"') || '"');
   --payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,column_value)::jsonb;
   payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,replace(column_value,'"','\"'))::jsonb;
   
   END LOOP;
  --RAISE notice 'After guideline json payload 1: "%"', payload_items;
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
  --PERFORM pg_notify('dev_db_notifications', payload);
   PERFORM pg_notify(channelname, payload);
  
  RETURN rec;
END;
$body$ LANGUAGE plpgsql

-------------------------------------------------------common_oltp.notify_trigger_common_oltp--------------------------------------------
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
  channelname TEXT;
  kafkatopicname TEXT;
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
  
    --channel and topic details
  RAISE notice ' % ',TG_TABLE_NAME; 
  SELECT channel, topic  into channelname, kafkatopicname from common_oltp.pgifx_tbl_channel_mapping where tablename = TG_TABLE_NAME limit 1;
  if (channelname = '') IS NOT FALSE then
          channelname = 'dev_db_notifications';
  RAISE info 'setting default dev_db_notifications';
  end if;
  RAISE info 'nofity_common_oltp_trigger';
  
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
    /*  when
      column_name = 'password' then 
         if (TG_TABLE_NAME = 'security_user') then
         column_value := (select regexp_replace(column_value, '([\r\n]+$)', '', 'g'));
         end if;*/
      when  
        column_name = 'create_date' then 
         if (TG_TABLE_NAME = 'user_social_login') then
         column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS'));
         else
         column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
         end if;
      when
         column_name = 'modify_date' then 
         if (TG_TABLE_NAME = 'security_user')  or (TG_TABLE_NAME = 'user_social_login') then
         column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS'));
         else
         column_value := (select to_char (column_value::timestamp, 'YYYY-MM-DD HH24:MI:SS.MS'));
         end if;
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

         --column_name = 'password' then 
         --column_value := regexp_replace(column_value, '\s', '', 'g');
         --column_value := regexp_replace(column_value, E'[\\n\\r]+', '\n\r', 'g');  
           else
    -- RAISE NOTICE ' not boolean';
    end case;
   -- payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,trim(regexp_replace(column_value, E'\n', ' ', 'g')))::jsonb;
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
              --|| '"data": {'      || array_to_string(payload_items, ',')  || '}'
              || '}}';
--  || '"data": {'      || array_to_string(payload_items, ',')  || '}'
--|| '"data":'       || payload_items  
  -- Notify the channel
 -- PERFORM pg_notify('dev_db_notifications', payload);
  PERFORM pg_notify(channelname, payload);
  RETURN rec;
END;
$body$ LANGUAGE plpgsql

-------------------------------------------------------informixoltp.notify_trigger_informixoltp--------------------------------------------

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
  channelname TEXT;
  kafkatopicname TEXT;
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
 
     --channel and topic details
  RAISE notice ' % ',TG_TABLE_NAME; 
  SELECT channel, topic  into channelname, kafkatopicname from common_oltp.pgifx_tbl_channel_mapping where tablename = TG_TABLE_NAME limit 1;
  if (channelname = '') IS NOT FALSE then
  channelname = 'dev_db_notifications';
  RAISE info 'setting default dev_db_notifications';
  end if;

  RAISE notice '%', channelname;
  
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
     -- when
      --   column_name = 'achievement_date' then 
      --column_value := (select to_date (column_value, 'MM/DD/YYYY'));
      --column_value := (select to_date (column_value));
     
           else
    -- RAISE NOTICE ' not boolean';
    end case;
  --  payload_items := array_append(payload_items, '"' || replace(column_name, '"', '\"') || '":"' || replace(column_value, '"', '\"') || '"');
    --payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,column_value)::jsonb;
    payload_items := coalesce(payload_items,'{}')::jsonb || json_build_object(column_name,replace(column_value,'"','\"'))::jsonb;
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
             -- || '"data": {'      || array_to_string(payload_items, ',')  || '}'
               || '"data": '    || payload_items
              || '}}';

  -- Notify the channel
  --PERFORM pg_notify('dev_db_notifications', payload);
  PERFORM pg_notify(channelname, payload);
  
  RETURN rec;
END;
$body$ LANGUAGE plpgsql
