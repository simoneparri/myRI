package it.myri.person;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface PersonRepository extends JpaRepository<Person, Long>, JpaSpecificationExecutor<Person> {
    boolean existsByMypadId(String mypadId);
    boolean existsByMypadIdAndIdNot(String mypadId, Long id);
    boolean existsByRsnoAgresso(String rsnoAgresso);
    boolean existsByRsnoAgressoAndIdNot(String rsnoAgresso, Long id);
    boolean existsByInsideId(String insideId);
    boolean existsByInsideIdAndIdNot(String insideId, Long id);
}
