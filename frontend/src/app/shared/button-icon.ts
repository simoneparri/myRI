import { Component, input } from '@angular/core';

const paths = {
  add: 'M12 5v14M5 12h14',
  filter: 'M4 5h16l-6 7v6l-4 2v-8Z',
  refresh: 'M20 10a8 8 0 1 0-2 8M20 4v6h-6',
  person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  detail: 'M5 3h14v18H5ZM9 8h6M9 12h6M9 16h4',
  edit: 'm4 16 12-12 4 4L8 20H4ZM13 7l4 4',
  archive: 'M3 4h18v4H3ZM5 8v12h14V8M9 12h6',
  send: 'm3 3 18 9-18 9 4-9ZM7 12h14',
  back: 'm10 5-7 7 7 7M3 12h18',
  check: 'm4 12 5 5L20 6',
  close: 'm5 5 14 14M19 5 5 19',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  save: 'M4 3h13l3 3v15H4ZM8 3v6h8V3M8 21v-8h8v8',
};

@Component({
  selector: 'svg[appButtonIcon]',
  host: {
    viewBox: '0 0 24 24',
    width: '18',
    height: '18',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
    style: 'vertical-align: middle; margin-right: 6px; flex-shrink: 0',
  },
  template: `<svg:path [attr.d]="paths[icon()]" />`,
})
export class ButtonIcon {
  readonly icon = input.required<keyof typeof paths>({ alias: 'appButtonIcon' });
  readonly paths = paths;
}
