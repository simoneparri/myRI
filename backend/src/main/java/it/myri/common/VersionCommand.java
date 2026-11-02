package it.myri.common;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record VersionCommand(@NotNull @PositiveOrZero Long version) {}
