package it.myri.common;

import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

public final class Queries {
    private Queries() {}

    public static PageRequest page(int page, int size, String sort, Set<String> allowed) {
        if (page < 0 || size < 1 || size > 100 || sort == null) {
            throw ApiException.invalid("Paginazione non valida.");
        }
        String[] parts = sort.split(",", -1);
        if (parts.length > 2 || !allowed.contains(parts[0])
                || (parts.length == 2 && !Set.of("asc", "desc").contains(parts[1]))) {
            throw ApiException.invalid("Ordinamento non valido.");
        }
        Sort order = Sort.by(parts.length == 2 && parts[1].equals("desc")
                ? Sort.Direction.DESC : Sort.Direction.ASC, parts[0]);
        if (!parts[0].equals("id")) {
            order = order.and(Sort.by("id"));
        }
        return PageRequest.of(page, size, order);
    }

    public static <T> Specification<T> visible(boolean includeArchived) {
        return (root, query, cb) -> includeArchived ? cb.conjunction() : cb.isNull(root.get("archivedAt"));
    }

    public static <T> Specification<T> equal(String field, Object value) {
        return (root, query, cb) -> value == null ? cb.conjunction() : cb.equal(root.get(field), value);
    }

    public static <T> Specification<T> text(String term, String... fields) {
        if (term != null && term.length() > 200) {
            throw ApiException.invalid("Ricerca troppo lunga.");
        }
        return (root, query, cb) -> {
            if (term == null || term.isBlank()) {
                return cb.conjunction();
            }
            String pattern = "%" + term.strip().toLowerCase(java.util.Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            return cb.or(java.util.Arrays.stream(fields)
                    .map(field -> cb.like(cb.lower(root.get(field)), pattern, '\\'))
                    .toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    public static <T> Specification<T> between(String field, Instant from, Instant to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw ApiException.invalid("Intervallo date non valido.");
        }
        return (root, query, cb) -> cb.and(
                from == null ? cb.conjunction() : cb.greaterThanOrEqualTo(root.get(field), from),
                to == null ? cb.conjunction() : cb.lessThan(root.get(field), to));
    }

    public static void version(MutableEntity entity, Long expected) {
        if (expected == null || !Objects.equals(entity.version, expected)) {
            throw ApiException.conflict("Versione obsoleta. Ricaricare la risorsa.");
        }
    }

    public static void editable(MutableEntity entity) {
        if (entity.archivedAt != null) {
            throw ApiException.conflict("La risorsa e archiviata.");
        }
    }

    public static String value(String value, Set<String> allowed) {
        if (value != null && !allowed.contains(value)) {
            throw ApiException.invalid("Valore filtro non valido.");
        }
        return value;
    }
}
