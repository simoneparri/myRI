import { TestBed } from '@angular/core/testing';
import { FrameworkIcons } from './framework-icons';

describe('FrameworkIcons', () => {
  it('loads the local Devicon stylesheet once', () => {
    TestBed.configureTestingModule({});
    const icons = TestBed.inject(FrameworkIcons);

    icons.load();
    icons.load();

    const stylesheets = document.querySelectorAll('#devicon-stylesheet');
    expect(stylesheets).toHaveLength(1);
    expect((stylesheets[0] as HTMLLinkElement).href).toContain(
      '/assets/devicon/devicon.min.css',
    );
  });
});
