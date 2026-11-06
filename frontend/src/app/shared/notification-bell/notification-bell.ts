import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { NotificationInbox, notificationTitle } from '../../core/notification-inbox';
import { Pwa } from '../../core/pwa';
import { DisplayPipe } from '../format';
import { ButtonIcon } from '../button-icon/button-icon';

@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink, MatBadgeModule, MatButtonModule, MatMenuModule, DisplayPipe, ButtonIcon],
  templateUrl: './notification-bell.html',
})
export class NotificationBell {
  readonly inbox = inject(NotificationInbox);
  readonly pwa = inject(Pwa);
  readonly title = notificationTitle;
}
