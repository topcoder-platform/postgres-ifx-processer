database common_oltp;

DROP PROCEDURE proc_user_update(varchar,decimal);
CREATE PROCEDURE informix.proc_user_update(
new_handle varchar(50),
user_id decimal(10,0))
   if (USER != 'ifxsyncuser') then
UPDATE user SET handle_lower = lower(new_handle), modify_date = current WHERE user.user_id = user_id;
End if;
end procedure; 

DROP PROCEDURE proc_user_update;     
create procedure "informix".proc_user_update(
user_id DECIMAL(10,0),
old_first_name VARCHAR(64),
new_first_name VARCHAR(64),
old_last_name VARCHAR(64),
new_last_name VARCHAR(64),
old_handle VARCHAR(50),
new_handle VARCHAR(50),
old_status VARCHAR(3),
new_status VARCHAR(3),
old_activation_code VARCHAR(32),
new_activation_code VARCHAR(32),
old_middle_name VARCHAR(64),
new_middle_name VARCHAR(64),
old_timezone_id decimal(5,0),
new_timezone_id decimal(5,0)
)
 if (USER != 'ifxsyncuser') then
 
      if ((old_first_name != new_first_name) or (old_last_name != new_last_name ) or (old_middle_name != new_middle_name )) then
         insert into audit_user (column_name, old_value, new_value,
user_id)
         values ('NAME', NVL(old_first_name, '') || ' ' || NVL(old_middle_name, '') || ' ' || NVL(old_last_name, ''),
                 NVL(new_first_name, '') || ' ' || NVL(new_middle_name,
'') || ' ' || NVL(new_last_name, ''), user_id);
      End if;
      
      if (old_handle != new_handle) then 
         insert into audit_user (column_name, old_value, new_value,
user_id)
         values ('HANDLE', old_handle, new_handle, user_id);
      End If;

      if (old_status != new_status) then 
         insert into audit_user (column_name, old_value, new_value,
user_id)
         values ('STATUS', old_status, new_status, user_id);
      End If;

      if (old_activation_code != new_activation_code) then 
         insert into audit_user (column_name, old_value, new_value,
user_id)
         values ('ACTIVATION_CODE', old_activation_code, new_activation_code, user_id);
      End If;

      if (old_timezone_id != new_timezone_id) then 
         insert into audit_user (column_name, old_value, new_value,
user_id)
         values ('TIMEZONE_ID', old_timezone_id, new_timezone_id, user_id);
      End If;
     
      UPDATE user SET handle_lower = lower(new_handle), modify_date = current WHERE user.user_id = user_id;
      End if;
end procedure;                                                                                                   

DROP PROCEDURE informix.proc_email_update;
CREATE PROCEDURE informix.proc_email_update(
email_id decimal(10,0),
user_id DECIMAL(10,0),
old_email_type_id DECIMAL(5,0),
new_email_type_id DECIMAL(5,0),
old_address VARCHAR(100),
new_address VARCHAR(100),
old_primary_ind DECIMAL(1,0),
new_primary_ind DECIMAL(1,0),
old_status_id DECIMAL(3,0),
new_status_id DECIMAL(3,0)
)

 if (USER != 'ifxsyncuser') then

      if (old_email_type_id != new_email_type_id) then
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('EMAIL_TYPE', old_email_type_id, new_email_type_id, user_id);
      End If;

      if (old_status_id != new_status_id) then
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('EMAIL_STATUS', old_status_id, new_status_id, user_id);
      End If;

      if (old_address != new_address) then
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('EMAIL_ADDRESS', old_address, new_address, user_id);
      End If;

      if (old_primary_ind != new_primary_ind) then
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('EMAIL_PRIMARY_IND', old_primary_ind, new_primary_ind, user_id);
      End If;
       
    update email set modify_date = current where email.email_id = email_id;
    End if;
end procedure;          

DROP PROCEDURE informix.proc_phone_update;
CREATE PROCEDURE informix.proc_phone_update(
phone_id decimal(10,0),
user_id DECIMAL(10,0),
old_phone_type_id DECIMAL(5,0),
new_phone_type_id DECIMAL(5,0),
old_number VARCHAR(64),
new_number VARCHAR(64),
old_primary_ind DECIMAL(1,0),
new_primary_ind DECIMAL(1,0)
)
 if (USER != 'ifxsyncuser') then
      if (old_phone_type_id != new_phone_type_id) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('PHONE_TYPE', old_phone_type_id, new_phone_type_id, user_id);
      End If;

      if (old_number != new_number) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('PHONE_NUMBER', old_number, new_number, user_id);
      End If;

      if (old_primary_ind != new_primary_ind) then 
         insert into audit_user (column_name, old_value, new_value, user_id)
         values ('PHONE_PRIMARY_IND', old_primary_ind, new_primary_ind, user_id);
      End If;
update phone set modify_date = current where phone.phone_id = phone_id;
End if;
end procedure;                                                                                                                                                                                                                                           

DROP PROCEDURE informix.proc_user_last_login;
CREATE PROCEDURE informix.proc_user_last_login (user_id DECIMAL(10,0), o_last_login DATETIME YEAR TO FRACTION, n_last_login DATETIME YEAR TO FRACTION)
    if (USER != 'ifxsyncuser') then
      if (o_last_login != n_last_login) then
         insert into corona_event (corona_event_type_id,user_id, corona_event_timestamp)  values (1, user_id, n_last_login);
      end if;
      End if;
end procedure;   

CREATE PROCEDURE informix.do_auditing2(sessionusername LVARCHAR)
EXTERNAL NAME "$INFORMIXDIR/extend/auditing/auditing.bld(do_auditing2)"
LANGUAGE C;      

CREATE TRIGGER "informix".ifxpgsync_user_insert insert on "informix".user for each row
        (
        execute procedure informix.do_auditing2(USER ));

CREATE TRIGGER "informix".ifxpgsync_user_update update on "informix".user  for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_user_delete delete on "informix".user    for each row
        (
        execute procedure "informix".do_auditing2(USER ));
        

CREATE TRIGGER "informix".ifxpgsync_email_insert insert on "informix".email    for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_email_update update on "informix".email    for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_email_delete delete on "informix".email   for each row
        (
        execute procedure "informix".do_auditing2(USER ));
        

CREATE TRIGGER informix.ifxpgsync_security_user_insert insert on "informix".security_user    for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_security_user_update update on "informix".security_user    for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_security_user_delete delete on "informix".security_user  for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_user_achievement_insert insert on "informix".user_achievement    for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_user_achievement_update update on "informix".user_achievement    for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_user_achievement_delete delete on "informix".user_achievement  for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_user_group_xref_insert insert on "informix".user_group_xref   for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_user_group_xref_update update on "informix".user_group_xref    for each row
        (
        execute procedure "informix".do_auditing2(USER ));
        

CREATE TRIGGER informix.ifxpgsync_insert_user_sso_login insert on user_sso_login  for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_update_user_sso_login update on user_sso_login for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_delete_user_sso_login delete on user_sso_login for each row
        (
        execute procedure "informix".do_auditing2(USER ));
        

create trigger informix.ifxpgsync_sso_login_provider_insert insert on informix.sso_login_provider for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_sso_login_provider_update update on informix.sso_login_provider for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_sso_login_provider_delete delete on informix.sso_login_provider for each row
(execute procedure informix.do_auditing2(USER ));

create trigger informix.ifxpgsync_social_login_provider_insert insert on informix.social_login_provider for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_social_login_provider_update update on informix.social_login_provider for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_social_login_provider_delete delete on informix.social_login_provider for each row
(execute procedure informix.do_auditing2(USER ));

create trigger informix.ifxpgsync_security_groups_insert insert on informix.security_groups for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_security_groups_update update on informix.security_groups for each row
(execute procedure informix.do_auditing2(USER ));
create trigger informix.ifxpgsync_security_groups_delete delete on informix.security_groups for each row
(execute procedure informix.do_auditing2(USER ));

create trigger informix.ifxpgsync_achievement_type_lu_insert insert on informix.achievement_type_lu for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_achievement_type_lu_update update on informix.achievement_type_lu for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_achievement_type_lu_delete delete on informix.achievement_type_lu for each row
(execute procedure informix.do_auditing2(USER ));

create trigger informix.ifxpgsync_country_insert insert on informix.country for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_country_update update on informix.country for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_country_delete delete on informix.country for each row
(execute procedure informix.do_auditing2(USER ));   


create trigger informix.ifxpgsync_user_social_login_insert insert on informix.user_social_login for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_user_social_login_update update on informix.user_social_login for each row
(execute procedure informix.do_auditing2(USER ));
create trigger informix.ifxpgsync_user_social_login_delete delete on informix.user_social_login for each row
(execute procedure informix.do_auditing2(USER ));


create trigger informix.ifxpgsync_invalid_handles_insert insert on informix.invalid_handles for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_invalid_handles_update update on informix.invalid_handles for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_invalid_handles_delete delete on informix.invalid_handles for each row
(execute procedure informix.do_auditing2(USER ));

create trigger informix.ifxpgsync_audit_user_insert insert on informix.audit_user for each row
(execute procedure informix.do_auditing2(USER ));	create trigger informix.ifxpgsync_audit_user_update update on informix.audit_user for each row
(execute procedure informix.do_auditing2(USER ));	create trigger informix.ifxpgsync_audit_user_delete delete on informix.audit_user for each row
(execute procedure informix.do_auditing2(USER ));

create trigger informix.ifxpgsync_corona_event_insert insert on informix.corona_event for each row
(execute procedure informix.do_auditing2(USER ));	create trigger informix.ifxpgsync_corona_event_update update on informix.corona_event for each row
(execute procedure informix.do_auditing2(USER ));	create trigger informix.ifxpgsync_corona_event_delete delete on informix.corona_event for each row
(execute procedure informix.do_auditing2(USER ));
                                                                                                       

database informixoltp;
drop PROCEDURE proc_coder_update;
CREATE PROCEDURE informix.proc_coder_update(
v_oldcoder_id decimal(10,0),
v_oldquote varchar(255),v_newquote varchar (255),
v_oldlanguage_id decimal(3,0), v_newlanguage_id decimal(3,0),
v_oldcoder_type_id decimal(3,0), v_newcoder_type_id decimal(3,0),
v_oldcomp_country_code varchar(3), v_newcomp_country_code varchar(3)
)
 if (USER != 'ifxsyncuser') then
      if (v_oldquote != v_newquote) then
         insert into audit_coder (column_name, old_value, new_value, user_id)
         values ('QUOTE', v_oldquote , v_newquote, v_oldcoder_id);
      End if;

      if (v_oldcoder_type_id != v_newcoder_type_id) then
         insert into audit_coder (column_name, old_value, new_value, user_id)
         values ('CODER_TYPE', v_oldcoder_type_id , v_newcoder_type_id, v_oldcoder_id);
      End if;

      if (v_oldlanguage_id != v_newlanguage_id) then
         insert into audit_coder (column_name, old_value, new_value, user_id)
         values ('LANGUAGE', v_oldlanguage_id , v_newlanguage_id, v_oldcoder_id);
      End if;

      if (v_oldcomp_country_code != v_newcomp_country_code) then
         insert into audit_coder (column_name, old_value, new_value, user_id)
         values ('COMP_COUNTRY', v_oldcomp_country_code , v_newcomp_country_code, v_oldcoder_id);
      End if;
 
      update coder set modify_date = current where coder_id = v_oldcoder_id;
      End if;
      
end procedure;                                                                                                                                         

CREATE PROCEDURE informix.do_auditing2(sessionusername LVARCHAR)
EXTERNAL NAME "$INFORMIXDIR/extend/auditing/auditing.bld(do_auditing2)"
LANGUAGE C;   

CREATE TRIGGER informix.ifxpgsync_insert_coder insert on "informix".coder    for each row
        (
        execute procedure "informix".do_auditing2(USER ));
        
CREATE TRIGGER informix.ifxpgsync_update_coder update on "informix".coder    for each row
        (
        execute procedure "informix".do_auditing2(USER ));
        
CREATE TRIGGER informix.ifxpgsync_delete_coder delete on "informix".coder    for each row
        (
        execute procedure "informix".do_auditing2(USER ));

CREATE TRIGGER informix.ifxpgsync_insert_algo_rating insert on "informix".algo_rating    for each row
        (
        execute procedure "informix".do_auditing2(USER ));
        
CREATE TRIGGER informix.ifxpgsync_update_algo_rating update on "informix".algo_rating    for each row
        (
        execute procedure "informix".do_auditing2(USER ));
        
CREATE TRIGGER informix.ifxpgsync_delete_algo_rating delete on "informix".algo_rating    for each row
        (
        execute procedure "informix".do_auditing2(USER ));
        
create trigger informix.ifxpgsync_coder_referral_insert insert on informix.coder_referral for each row
(execute procedure informix.do_auditing2(USER ));
create trigger informix.ifxpgsync_coder_referral_update update on informix.coder_referral for each row
(execute procedure informix.do_auditing2(USER ));	
create trigger informix.ifxpgsync_coder_referral_delete delete on informix.coder_referral for each row
(execute procedure informix.do_auditing2(USER ));

