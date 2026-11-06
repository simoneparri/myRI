import { Routes } from '@angular/router';
import { authGuard } from './core/auth';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then((m) => m.Login) },
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications').then((m) => m.Notifications),
      },
      {
        path: 'salary-comparison',
        loadComponent: () =>
          import('./features/salary-comparison/salary-comparison').then((m) => m.SalaryComparison),
      },
      {
        path: 'people/:id',
        loadComponent: () => import('./features/person-page/person-page').then((m) => m.PersonPage),
      },
      ...(['people', 'raise-requests', 'career-talks', 'tasks'] as const).map((resource) => ({
        path: resource,
        data: { resource },
        loadComponent: () =>
          import('./features/resource-page/resource-page').then((m) => m.ResourcePage),
      })),
      { path: '', pathMatch: 'full', redirectTo: 'people' },
    ],
  },
  { path: '**', redirectTo: 'people' },
];
