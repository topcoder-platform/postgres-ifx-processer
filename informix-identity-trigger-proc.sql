database common_oltp
DROP PROCEDURE proc_user_update(varchar,decimal);
DROP PROCEDURE proc_user_update;
CREATE PROCEDURE informix.proc_user_update(
new_handle varchar(50),
user_id decimal(10,0))
   if (USER != 'ifxsyncuser') then
UPDATE user SET handle_lower = lower(new_handle), modify_date = current WHERE user.user_id = user_id;
End if;
end procedure;                                  
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
      if (USER != 'ifxsyncuser') then
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
        if (USER != 'ifxsyncuser') then
    update email set modify_date = current where email.email_id = email_id;
    End if;
end procedure;


database informixoltp
DROP PROCEDURE informix.proc_coder_update;
CREATE PROCEDURE informix.proc_coder_update(
v_oldcoder_id decimal(10,0),
v_oldquote varchar(255),v_newquote varchar (255),
v_oldlanguage_id decimal(3,0), v_newlanguage_id decimal(3,0),
v_oldcoder_type_id decimal(3,0), v_newcoder_type_id decimal(3,0),
v_oldcomp_country_code varchar(3), v_newcomp_country_code varchar(3)
)

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

      if (USER != 'ifxsyncuser') then
      update coder set modify_date = current where coder_id = v_oldcoder_id;
      End if;

end procedure;

database tcs_catalog;
DROP PROCEDURE proc_reliability_update;
CREATE PROCEDURE informix.proc_reliability_update(
p_user_id DECIMAL(10,0),
p_phase_id decimal(3,0),
old_rating decimal(5,4),
new_rating decimal(5,4)
)

 if (USER != 'ifxsyncuser') then
      if (old_rating != new_rating) then 
         insert into user_reliability_audit (column_name, old_value, new_value, user_id, phase_id)
         values ('RATING', old_rating, new_rating, p_user_id, p_phase_id);
      End If;

      update user_reliability set modify_date = current where user_id = p_user_id and phase_id = p_phase_id;
End if;
end procedure;   

DROP PROCEDURE proc_rating_update;
CREATE PROCEDURE informix.proc_rating_update(
p_user_id DECIMAL(10,0),
p_phase_id decimal(3,0),
old_rating decimal(10,0),
new_rating decimal(10,0),
old_vol decimal(10,0),
new_vol decimal(10,0),
old_num_ratings decimal(5,0),
new_num_ratings decimal(5,0),
old_last_rated_project_id decimal(12,0),
new_last_rated_project_id decimal(12,0)
)
 if (USER != 'ifxsyncuser') then
      if (old_rating != new_rating) then 
         insert into user_rating_audit (column_name, old_value, new_value, user_id, phase_id)
         values ('RATING', old_rating, new_rating, p_user_id, p_phase_id);
      End If;

      if (old_vol != new_vol) then 
         insert into user_rating_audit (column_name, old_value, new_value, user_id, phase_id)
         values ('VOL', old_vol, new_vol, p_user_id, p_phase_id);
      End If;

      if (old_num_ratings != new_num_ratings) then 
         insert into user_rating_audit (column_name, old_value, new_value, user_id, phase_id)
         values ('NUM_RATINGS', old_num_ratings, new_num_ratings, p_user_id, p_phase_id);
      End If;

      if (old_last_rated_project_id != new_last_rated_project_id) then 
         insert into user_rating_audit (column_name, old_value, new_value, user_id, phase_id)
         values ('LAST_RATED_PROJECT_ID', old_last_rated_project_id, new_last_rated_project_id, p_user_id, p_phase_id);
      End If;

      update user_rating set mod_date_time = current where user_id = p_user_id and phase_id = p_phase_id;
End if;
end procedure;      

DROP PROCEDURE proc_contest_creation_update;
CREATE PROCEDURE informix.proc_contest_creation_update (create_user VARCHAR(64), old_project_status_id INT, new_project_status_id INT)
if (USER != 'ifxsyncuser') then
      if (old_project_status_id != new_project_status_id and new_project_status_id == 1) then
         insert into corona_event (corona_event_type_id,user_id)  values (5, TO_NUMBER(create_user));
      end if;
End if;
end procedure;
