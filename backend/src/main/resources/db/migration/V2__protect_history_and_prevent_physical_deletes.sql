CREATE TRIGGER tr_salary_no_update BEFORE UPDATE ON salary
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'salary is append-only';

CREATE TRIGGER tr_audit_event_no_update BEFORE UPDATE ON audit_event
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_event is append-only';

CREATE TRIGGER tr_app_user_no_delete BEFORE DELETE ON app_user
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';

CREATE TRIGGER tr_person_no_delete BEFORE DELETE ON person
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';

CREATE TRIGGER tr_contact_no_delete BEFORE DELETE ON contact
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';

CREATE TRIGGER tr_salary_no_delete BEFORE DELETE ON salary
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';

CREATE TRIGGER tr_raise_request_no_delete BEFORE DELETE ON raise_request
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';

CREATE TRIGGER tr_career_talk_no_delete BEFORE DELETE ON career_talk
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';

CREATE TRIGGER tr_task_no_delete BEFORE DELETE ON task
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';

CREATE TRIGGER tr_notification_no_delete BEFORE DELETE ON notification
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';

CREATE TRIGGER tr_audit_event_no_delete BEFORE DELETE ON audit_event
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';

DELIMITER $$
CREATE TRIGGER tr_person_manager_no_self_insert BEFORE INSERT ON person
FOR EACH ROW
BEGIN
    IF NEW.manager_id IS NOT NULL AND NEW.id <> 0 AND NEW.manager_id = NEW.id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'self reporting is disabled';
    END IF;
END$$

CREATE TRIGGER tr_person_manager_no_self_update BEFORE UPDATE ON person
FOR EACH ROW
BEGIN
    IF NEW.manager_id = NEW.id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'self reporting is disabled';
    END IF;
END$$

CREATE TRIGGER tr_task_source_no_self_update BEFORE UPDATE ON task
FOR EACH ROW
BEGIN
    IF NEW.source_task_id = NEW.id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'self recurrence is disabled';
    END IF;
END$$

CREATE TRIGGER tr_task_source_no_self_insert BEFORE INSERT ON task
FOR EACH ROW
BEGIN
    IF NEW.source_task_id IS NOT NULL AND NEW.id <> 0 AND NEW.source_task_id = NEW.id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'self recurrence is disabled';
    END IF;
END$$
DELIMITER ;
