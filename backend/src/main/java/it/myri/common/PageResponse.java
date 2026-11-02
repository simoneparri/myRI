package it.myri.common;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

public record PageResponse<T>(List<T> items, int page, int size, long totalElements, int totalPages) {
    public static <E, T> PageResponse<T> of(Page<E> source, Function<E, T> mapper) {
        return new PageResponse<>(source.stream().map(mapper).toList(), source.getNumber(),
                source.getSize(), source.getTotalElements(), source.getTotalPages());
    }
}
