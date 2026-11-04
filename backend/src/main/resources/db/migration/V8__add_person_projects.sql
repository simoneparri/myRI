CREATE TABLE project (
    id BIGINT NOT NULL AUTO_INCREMENT,
    person_id BIGINT NOT NULL,
    client VARCHAR(200) NOT NULL,
    starts_on DATE NULL,
    ends_on DATE NULL,
    business_manager VARCHAR(200) NULL,
    work_mode VARCHAR(10) NOT NULL,
    notes TEXT NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    INDEX ix_project_person_dates (person_id, starts_on, ends_on),
    INDEX ix_project_ends_on (ends_on),
    CONSTRAINT fk_project_person FOREIGN KEY (person_id) REFERENCES person (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_project_client CHECK (CHAR_LENGTH(TRIM(client)) > 0),
    CONSTRAINT ck_project_dates CHECK (
        starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on
    ),
    CONSTRAINT ck_project_work_mode CHECK (work_mode IN ('onsite', 'remote', 'hybrid')),
    CONSTRAINT ck_project_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TRIGGER tr_project_no_delete BEFORE DELETE ON project
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';
