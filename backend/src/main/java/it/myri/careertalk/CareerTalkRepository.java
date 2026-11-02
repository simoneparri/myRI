package it.myri.careertalk;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CareerTalkRepository extends JpaRepository<CareerTalk, Long>, JpaSpecificationExecutor<CareerTalk> {}
