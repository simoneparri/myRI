CREATE TABLE company_closure (
    id BIGINT NOT NULL AUTO_INCREMENT,
    closed_on DATE NOT NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_company_closure_date UNIQUE (closed_on),
    CONSTRAINT ck_company_closure_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TRIGGER tr_company_closure_no_delete BEFORE DELETE ON company_closure
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'physical deletion is disabled';
