import { MatPaginatorIntl } from '@angular/material/paginator';

export function italianPaginator(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'Elementi per pagina';
  intl.nextPageLabel = 'Pagina successiva';
  intl.previousPageLabel = 'Pagina precedente';
  intl.getRangeLabel = (page, size, total) =>
    total === 0 ? '0 di 0' : `${page * size + 1}-${Math.min((page + 1) * size, total)} di ${total}`;
  return intl;
}
