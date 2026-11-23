CREATE TABLE absence (
    id BIGINT NOT NULL AUTO_INCREMENT,
    person_id BIGINT NOT NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    absence_code VARCHAR(100) NOT NULL,
    absence_label VARCHAR(255) NOT NULL,
    workflow_status VARCHAR(100) NOT NULL,
    days VARCHAR(50) NOT NULL,
    hours VARCHAR(50) NOT NULL,
    imported_to_timesheet VARCHAR(100) NOT NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    INDEX ix_absence_person_interval (person_id, archived_at, starts_at, ends_at),
    INDEX ix_absence_interval (archived_at, starts_at, ends_at),
    CONSTRAINT fk_absence_person FOREIGN KEY (person_id) REFERENCES person (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_absence_interval CHECK (starts_at < ends_at),
    CONSTRAINT ck_absence_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TRIGGER tr_absence_no_delete BEFORE DELETE ON absence
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';
