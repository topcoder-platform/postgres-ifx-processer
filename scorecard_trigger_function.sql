SET search_path TO tcs_catalog;

CREATE OR REPLACE FUNCTION "tcs_catalog"."notify_trigger" ()  RETURNS trigger
  VOLATILE
AS $body$
DECLARE
  rec RECORD;
  payload TEXT;
  column_name TEXT;
  column_value TEXT;
  payload_items TEXT[];
  uniquecolumn TEXT;
  logtime TEXT;
BEGIN
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
    -- RAISE NOTICE ' not boolean';
    end case;
    payload_items := array_append(payload_items, '"' || replace(column_name, '"', '\"') || '":"' || replace(column_value, '"', '\"') || '"');
  END LOOP;
  --logtime := (select date_display_tz());
  logtime := (SELECT to_char (now()::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  
  uniquecolumn := (SELECT c.column_name
        FROM information_schema.key_column_usage AS c
        LEFT JOIN information_schema.table_constraints AS t
        ON t.constraint_name = c.constraint_name
        WHERE t.table_name = TG_TABLE_NAME AND t.constraint_type = 'PRIMARY KEY');

  -- Build the payload
  payload := ''
              || '{'
              || '"topic":"' || 'db.postgres.sync' || '",'
              || '"originator":"' || 'tc-postgres-delta-processor' || '",'
          --    || '"timestamp":"' || '2019-08-19T08:39:48.959Z'                   || '",'   
            || '"timestamp":"' || logtime  || '",'
              || '"mime-type":"' || 'application/json'                   || '",'
              || '"payload": {'      
              
              || '"Uniquecolumn":"' || uniquecolumn                   || '",'
              || '"operation":"' || TG_OP                                || '",'
              || '"schema":"'    || TG_TABLE_SCHEMA                      || '",'
              || '"table":"'     || TG_TABLE_NAME                        || '",'
              || '"data": {'      || array_to_string(payload_items, ',')  || '}'
              || '}}';

  -- Notify the channel
  PERFORM pg_notify('db_notifications', payload);
  
  RETURN rec;
END;
$body$ LANGUAGE plpgsql
                              


CREATE TRIGGER "scorecard_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON scorecard
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger('scorecard_id', 'scorecard_status_id', 'scorecard_type_id', 'project_category_id', 'name', 'version', 'min_score', 'max_score', 'create_user', 'create_date', 'modify_user', 'modify_date', 'version_number');

CREATE TRIGGER "default_scorecard_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON default_scorecard
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger('project_category_id','scorecard_type_id', 'scorecard_id','create_user', 'create_date', 'modify_user', 'modify_date');

CREATE TRIGGER "scorecard_group_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON scorecard_group
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger('scorecard_group_id','scorecard_id','name','weight','sort','create_user','create_date','modify_user' ,'modify_date','version');

CREATE TRIGGER "scorecard_question_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON scorecard_question
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger('project_status_id', 'name', 'description', 'create_user', 'create_date', 'modify_user', 'modify_date');


CREATE TRIGGER "scorecard_section_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON scorecard_section
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger('scorecard_section_id','scorecard_group_id','name','weight','sort','create_user','create_date','modify_user' ,'modify_date','version');


CREATE TRIGGER "scorecard_question_type_lu_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON scorecard_question_type_lu
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger('scorecard_question_id','scorecard_question_type_id','scorecard_section_id','description','guideline', 'weight','sort','upload_document','upload_document_required','create_user','create_date','modify_user' ,'modify_date','version');


CREATE TRIGGER "scorecard_status_lu_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON scorecard_status_lu
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger('scorecard_status_id', 'name', 'description', 'create_user', 'create_date', 'modify_user', 'modify_date','version');

CREATE TRIGGER "scorecard_type_lu_trigger"
  AFTER INSERT OR DELETE OR UPDATE ON scorecard_type_lu
  FOR EACH ROW
EXECUTE PROCEDURE notify_trigger('scorecard_type_id', 'name', 'description', 'create_user', 'create_date', 'modify_user', 'modify_date','version');
