CREATE TABLE app_user (
    id BIGINT NOT NULL AUTO_INCREMENT,
    singleton_key TINYINT NOT NULL DEFAULT 1,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    disabled_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uq_app_user_singleton UNIQUE (singleton_key),
    CONSTRAINT uq_app_user_username UNIQUE (username),
    CONSTRAINT ck_app_user_singleton CHECK (singleton_key = 1),
    CONSTRAINT ck_app_user_username CHECK (CHAR_LENGTH(TRIM(username)) > 0),
    CONSTRAINT ck_app_user_password_hash CHECK (CHAR_LENGTH(password_hash) >= 60),
    CONSTRAINT ck_app_user_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE person (
    id BIGINT NOT NULL AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NULL,
    phone VARCHAR(50) NULL,
    role VARCHAR(150) NULL,
    seniority VARCHAR(100) NULL,
    hiring_location VARCHAR(200) NULL,
    residence VARCHAR(500) NULL,
    hired_on DATE NOT NULL,
    career_started_on DATE NULL,
    seniority_level VARCHAR(10) NULL,
    mypad_id VARCHAR(100) NULL,
    born_on DATE NULL,
    rsno_agresso VARCHAR(100) NULL,
    inside_id VARCHAR(100) NULL,
    education VARCHAR(20) NULL,
    frameworks JSON NOT NULL DEFAULT (JSON_ARRAY()),
    capacity_management TEXT NULL,
    manager_id BIGINT NULL,
    external_manager VARCHAR(200) NULL,
    notes TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    INDEX ix_person_manager (manager_id),
    INDEX ix_person_status_name (status, last_name, first_name),
    CONSTRAINT fk_person_manager FOREIGN KEY (manager_id) REFERENCES person (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_person_names CHECK (
        CHAR_LENGTH(TRIM(first_name)) > 0 AND CHAR_LENGTH(TRIM(last_name)) > 0
    ),
    CONSTRAINT ck_person_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT ck_person_career_start CHECK (
        career_started_on IS NULL OR career_started_on <= hired_on
    ),
    CONSTRAINT ck_person_seniority_level CHECK (
        seniority_level IS NULL OR seniority_level IN ('junior', 'medior', 'senior')
    ),
    CONSTRAINT ck_person_mypad_id CHECK (
        mypad_id IS NULL OR REGEXP_LIKE(mypad_id, '^[A-Za-z0-9_-]+$', 'c')
    ),
    CONSTRAINT uk_person_mypad_id UNIQUE (mypad_id),
    CONSTRAINT uk_person_rsno_agresso UNIQUE (rsno_agresso),
    CONSTRAINT uk_person_inside_id UNIQUE (inside_id),
    CONSTRAINT chk_person_education
        CHECK (education IN ('diploma', 'bachelor', 'master', 'phd')),
    CONSTRAINT ck_person_frameworks CHECK (
        JSON_TYPE(frameworks) = 'ARRAY' AND JSON_LENGTH(frameworks) <= 50
    ),
    CONSTRAINT ck_person_manager CHECK (
        manager_id IS NULL OR external_manager IS NULL
    ),
    CONSTRAINT ck_person_external_manager CHECK (
        external_manager IS NULL OR CHAR_LENGTH(TRIM(external_manager)) > 0
    ),
    CONSTRAINT ck_person_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE contact (
    id BIGINT NOT NULL AUTO_INCREMENT,
    person_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    value VARCHAR(500) NOT NULL,
    contacted_on DATE NULL,
    notes TEXT NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    INDEX ix_contact_person (person_id),
    INDEX ix_contact_person_contacted_on (person_id, contacted_on DESC, id),
    CONSTRAINT fk_contact_person FOREIGN KEY (person_id) REFERENCES person (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_contact_content CHECK (
        CHAR_LENGTH(TRIM(type)) > 0 AND CHAR_LENGTH(TRIM(value)) > 0
    ),
    CONSTRAINT ck_contact_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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

CREATE TABLE salary (
    id BIGINT NOT NULL AUTO_INCREMENT,
    person_id BIGINT NOT NULL,
    request_key VARCHAR(100) NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    effective_on DATE NOT NULL,
    reason TEXT NOT NULL,
    contract_type VARCHAR(100) NULL,
    weekly_hours DECIMAL(5,2) NULL,
    classification_level VARCHAR(100) NULL,
    meal_vouchers BOOLEAN NULL,
    bonus_letter_amount DECIMAL(12,2) NULL,
    company_car BOOLEAN NULL,
    source_raise_request_id BIGINT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_salary_request_key UNIQUE (request_key),
    CONSTRAINT uq_salary_person_id UNIQUE (person_id, id),
    CONSTRAINT uq_salary_person_id_currency UNIQUE (person_id, id, currency),
    CONSTRAINT uq_salary_source_raise UNIQUE (source_raise_request_id),
    INDEX ix_salary_person_effective (person_id, effective_on, id),
    INDEX ix_salary_source_scope (person_id, source_raise_request_id, currency),
    CONSTRAINT fk_salary_person FOREIGN KEY (person_id) REFERENCES person (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_salary_amount CHECK (amount > 0),
    CONSTRAINT ck_salary_currency CHECK (
        REGEXP_LIKE(currency, '^[A-Z]{3}$', 'c')
    ),
    CONSTRAINT ck_salary_reason CHECK (CHAR_LENGTH(TRIM(reason)) > 0),
    CONSTRAINT ck_salary_weekly_hours CHECK (
        weekly_hours IS NULL OR (weekly_hours > 0 AND weekly_hours <= 168)
    ),
    CONSTRAINT ck_salary_contract_type CHECK (
        contract_type IS NULL OR CHAR_LENGTH(TRIM(contract_type)) > 0
    ),
    CONSTRAINT ck_salary_classification_level CHECK (
        classification_level IS NULL OR CHAR_LENGTH(TRIM(classification_level)) > 0
    ),
    CONSTRAINT ck_salary_meal_vouchers CHECK (meal_vouchers IN (0, 1)),
    CONSTRAINT ck_salary_bonus_letter_amount CHECK (bonus_letter_amount >= 0),
    CONSTRAINT ck_salary_company_car CHECK (company_car IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE raise_request (
    id BIGINT NOT NULL AUTO_INCREMENT,
    person_id BIGINT NOT NULL,
    base_salary_id BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    requested_on DATE NOT NULL,
    requested_salary DECIMAL(12,2) NULL,
    requested_percentage DECIMAL(9,4) NULL,
    benefits_specified BOOLEAN NOT NULL DEFAULT FALSE,
    meal_vouchers BOOLEAN NULL,
    bonus_letter_amount DECIMAL(12,2) NULL,
    company_car BOOLEAN NULL,
    motivation TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    outcome_on DATE NULL,
    outcome_notes TEXT NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uq_raise_request_person_id UNIQUE (person_id, id),
    CONSTRAINT uq_raise_request_person_id_currency UNIQUE (person_id, id, currency),
    INDEX ix_raise_request_base_salary (base_salary_id),
    INDEX ix_raise_request_base_scope (person_id, base_salary_id, currency),
    INDEX ix_raise_request_status_date (status, requested_on),
    INDEX ix_raise_request_archived_status (archived_at, status),
    CONSTRAINT fk_raise_request_person FOREIGN KEY (person_id) REFERENCES person (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_raise_request_base_salary FOREIGN KEY (person_id, base_salary_id, currency)
        REFERENCES salary (person_id, id, currency) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_raise_request_value CHECK (
        (requested_salary IS NOT NULL OR requested_percentage IS NOT NULL)
        AND (requested_salary IS NULL OR requested_salary > 0)
        AND (requested_percentage IS NULL OR requested_percentage > 0)
    ),
    CONSTRAINT ck_raise_request_motivation CHECK (CHAR_LENGTH(TRIM(motivation)) > 0),
    CONSTRAINT ck_raise_request_status CHECK (
        status IN ('draft', 'submitted', 'approved', 'rejected', 'postponed')
    ),
    CONSTRAINT ck_raise_request_outcome CHECK (
        (status IN ('draft', 'submitted') AND outcome_on IS NULL)
        OR (status IN ('approved', 'rejected', 'postponed')
            AND outcome_on IS NOT NULL AND outcome_on >= requested_on)
    ),
    CONSTRAINT ck_raise_benefits_specified CHECK (benefits_specified IN (0, 1)),
    CONSTRAINT ck_raise_meal_vouchers CHECK (meal_vouchers IN (0, 1)),
    CONSTRAINT ck_raise_bonus_letter_amount CHECK (bonus_letter_amount >= 0),
    CONSTRAINT ck_raise_company_car CHECK (company_car IN (0, 1)),
    CONSTRAINT ck_raise_unspecified_benefits CHECK (
        benefits_specified = 1 OR
        (meal_vouchers IS NULL AND bonus_letter_amount IS NULL AND company_car IS NULL)
    ),
    CONSTRAINT ck_raise_request_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE salary
    ADD CONSTRAINT fk_salary_source_raise FOREIGN KEY (person_id, source_raise_request_id, currency)
        REFERENCES raise_request (person_id, id, currency)
        ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE career_talk (
    id BIGINT NOT NULL AUTO_INCREMENT,
    person_id BIGINT NOT NULL,
    held_at DATETIME(6) NOT NULL,
    topics TEXT NULL,
    agreed_goals TEXT NULL,
    feedback_given TEXT NULL,
    feedback_received TEXT NULL,
    next_steps TEXT NULL,
    suggested_next_on DATE NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uq_career_talk_person_id UNIQUE (person_id, id),
    INDEX ix_career_talk_held_at (held_at),
    INDEX ix_career_talk_person_held_at (person_id, held_at, id),
    INDEX ix_career_talk_person_archived_held (person_id, archived_at, held_at, id),
    CONSTRAINT fk_career_talk_person FOREIGN KEY (person_id) REFERENCES person (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_career_talk_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    due_at DATETIME(6) NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'todo',
    person_id BIGINT NULL,
    career_talk_id BIGINT NULL,
    raise_request_id BIGINT NULL,
    recurrence_frequency VARCHAR(10) NULL,
    recurrence_interval INT NULL,
    source_task_id BIGINT NULL,
    completed_at DATETIME(6) NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uq_task_successor UNIQUE (source_task_id),
    INDEX ix_task_due_at (due_at),
    INDEX ix_task_status_due_at (status, due_at),
    INDEX ix_task_archived_status_due (archived_at, status, due_at),
    INDEX ix_task_person_due_at (person_id, due_at),
    INDEX ix_task_career_talk (career_talk_id),
    INDEX ix_task_career_talk_scope (person_id, career_talk_id),
    INDEX ix_task_raise_request (raise_request_id),
    INDEX ix_task_raise_request_scope (person_id, raise_request_id),
    CONSTRAINT fk_task_person FOREIGN KEY (person_id) REFERENCES person (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_task_career_talk FOREIGN KEY (person_id, career_talk_id)
        REFERENCES career_talk (person_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_task_raise_request FOREIGN KEY (person_id, raise_request_id)
        REFERENCES raise_request (person_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_task_source FOREIGN KEY (source_task_id) REFERENCES task (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_task_title CHECK (CHAR_LENGTH(TRIM(title)) > 0),
    CONSTRAINT ck_task_priority CHECK (priority IN ('low', 'medium', 'high')),
    CONSTRAINT ck_task_status CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
    CONSTRAINT ck_task_link_scope CHECK (
        (career_talk_id IS NULL AND raise_request_id IS NULL) OR person_id IS NOT NULL
    ),
    CONSTRAINT ck_task_recurrence CHECK (
        (recurrence_frequency IS NULL AND recurrence_interval IS NULL)
        OR (recurrence_frequency IS NOT NULL AND recurrence_interval IS NOT NULL
            AND recurrence_frequency IN ('daily', 'weekly', 'monthly')
            AND recurrence_interval > 0 AND due_at IS NOT NULL)
    ),
    CONSTRAINT ck_task_completion CHECK (
        (status = 'done' AND completed_at IS NOT NULL)
        OR (status <> 'done' AND completed_at IS NULL)
    ),
    CONSTRAINT ck_task_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification (
    id BIGINT NOT NULL AUTO_INCREMENT,
    kind VARCHAR(30) NOT NULL,
    deduplication_key VARCHAR(160) NOT NULL,
    person_id BIGINT NULL,
    task_id BIGINT NULL,
    triggered_at DATETIME(6) NOT NULL,
    read_at DATETIME(6) NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uq_notification_deduplication UNIQUE (deduplication_key),
    INDEX ix_notification_person (person_id),
    INDEX ix_notification_task (task_id),
    INDEX ix_notification_unread_triggered (read_at, triggered_at),
    CONSTRAINT fk_notification_person FOREIGN KEY (person_id) REFERENCES person (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_notification_task FOREIGN KEY (task_id) REFERENCES task (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_notification_kind CHECK (
        (kind = 'task_due' AND task_id IS NOT NULL AND person_id IS NULL)
        OR (kind = 'career_talk_due' AND person_id IS NOT NULL AND task_id IS NULL)
    ),
    CONSTRAINT ck_notification_key CHECK (CHAR_LENGTH(TRIM(deduplication_key)) > 0),
    CONSTRAINT ck_notification_version CHECK (version >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE audit_event (
    id BIGINT NOT NULL AUTO_INCREMENT,
    actor_id BIGINT NOT NULL,
    person_id BIGINT NOT NULL,
    salary_id BIGINT NULL,
    raise_request_id BIGINT NULL,
    action VARCHAR(30) NOT NULL,
    changed_fields VARCHAR(500) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX ix_audit_event_actor (actor_id),
    INDEX ix_audit_event_person_time (person_id, occurred_at),
    INDEX ix_audit_event_salary (salary_id),
    INDEX ix_audit_event_salary_scope (person_id, salary_id),
    INDEX ix_audit_event_raise_request (raise_request_id),
    INDEX ix_audit_event_raise_scope (person_id, raise_request_id),
    CONSTRAINT fk_audit_event_actor FOREIGN KEY (actor_id) REFERENCES app_user (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_audit_event_person FOREIGN KEY (person_id) REFERENCES person (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_audit_event_salary FOREIGN KEY (person_id, salary_id)
        REFERENCES salary (person_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_audit_event_raise FOREIGN KEY (person_id, raise_request_id)
        REFERENCES raise_request (person_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_audit_event_target CHECK (
        (salary_id IS NOT NULL AND raise_request_id IS NULL AND action = 'salary_created')
        OR (salary_id IS NULL AND raise_request_id IS NOT NULL
            AND action IN ('raise_created', 'raise_updated', 'raise_archived'))
    ),
    CONSTRAINT ck_audit_event_fields CHECK (CHAR_LENGTH(TRIM(changed_fields)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
