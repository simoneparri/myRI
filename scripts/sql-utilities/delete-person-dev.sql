-- Administrative utility, NOT a Flyway migration. Fictitious dev/test data only.
-- Disable dev triggers explicitly beforehand; this file never changes protections or grants.
-- Required session variables: @myri_dev_database_confirm, @person_id.
DELIMITER $$
CREATE PROCEDURE myri_delete_person_dev()
SQL SECURITY INVOKER
BEGIN
    DECLARE target_id BIGINT;
    DECLARE found_id BIGINT DEFAULT NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF DATABASE() IS NULL OR NOT REGEXP_LIKE(DATABASE(), '_(dev|test)$', 'c') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refusing: dev/test database required';
    END IF;
    IF @myri_dev_database_confirm IS NULL
            OR BINARY @myri_dev_database_confirm <> BINARY 'fictitious-data-only' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refusing: explicit fictitious data confirmation required';
    END IF;
    IF @person_id IS NULL OR NOT REGEXP_LIKE(CAST(@person_id AS CHAR), '^[1-9][0-9]{0,18}$', 'c')
            OR CAST(@person_id AS DECIMAL(20,0)) > 9223372036854775807 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refusing: positive BIGINT person ID required';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = DATABASE()
          AND event_object_table IN (
              'person', 'contact', 'project', 'salary', 'raise_request',
              'career_talk', 'task', 'notification', 'audit_event'
          )
          AND (event_manipulation = 'DELETE' OR trigger_name = 'tr_salary_no_update')
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refusing: disable development triggers explicitly first';
    END IF;

    SET target_id = CAST(@person_id AS SIGNED);
    START TRANSACTION;
    SELECT id INTO found_id FROM person WHERE id = target_id FOR UPDATE;
    IF found_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refusing: person ID does not exist';
    END IF;

    DELETE n FROM notification n
        LEFT JOIN task t ON t.id = n.task_id
        WHERE n.person_id = target_id OR t.person_id = target_id;
    DELETE FROM audit_event WHERE person_id = target_id;
    -- Break recurrence and financial cycles without disabling foreign key checks.
    UPDATE task successor JOIN task predecessor ON predecessor.id = successor.source_task_id
        SET successor.source_task_id = NULL WHERE predecessor.person_id = target_id;
    DELETE FROM task WHERE person_id = target_id;
    UPDATE salary SET source_raise_request_id = NULL WHERE person_id = target_id;
    DELETE FROM raise_request WHERE person_id = target_id;
    DELETE FROM salary WHERE person_id = target_id;
    DELETE FROM career_talk WHERE person_id = target_id;
    DELETE FROM project WHERE person_id = target_id;
    DELETE FROM contact WHERE person_id = target_id;
    UPDATE person SET manager_id = NULL WHERE manager_id = target_id;
    DELETE FROM person WHERE id = target_id;
    COMMIT;
    SELECT 'Deleted fictitious person and related data' AS result;
END$$
DELIMITER ;

CALL myri_delete_person_dev();
DROP PROCEDURE myri_delete_person_dev;
