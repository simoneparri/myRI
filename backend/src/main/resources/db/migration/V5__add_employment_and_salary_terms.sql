ALTER TABLE person
    ADD COLUMN hiring_location VARCHAR(200) NULL,
    ADD COLUMN residence VARCHAR(500) NULL;

ALTER TABLE salary
    ADD COLUMN contract_type VARCHAR(100) NULL,
    ADD COLUMN weekly_hours DECIMAL(5,2) NULL,
    ADD COLUMN classification_level VARCHAR(100) NULL,
    ADD CONSTRAINT ck_salary_weekly_hours CHECK (
        weekly_hours IS NULL OR (weekly_hours > 0 AND weekly_hours <= 168)
    ),
    ADD CONSTRAINT ck_salary_contract_type CHECK (
        contract_type IS NULL OR CHAR_LENGTH(TRIM(contract_type)) > 0
    ),
    ADD CONSTRAINT ck_salary_classification_level CHECK (
        classification_level IS NULL OR CHAR_LENGTH(TRIM(classification_level)) > 0
    );
