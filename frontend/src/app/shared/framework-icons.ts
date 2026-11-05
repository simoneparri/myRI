import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FrameworkIcons {
  private readonly document = inject(DOCUMENT);

  load(): void {
    if (this.document.getElementById('devicon-stylesheet')) return;
    const stylesheet = this.document.createElement('link');
    stylesheet.id = 'devicon-stylesheet';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('assets/devicon/devicon.min.css', this.document.baseURI).toString();
    this.document.head.append(stylesheet);
  }
}
