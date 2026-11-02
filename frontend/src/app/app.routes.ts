import { Routes } from '@angular/router';
import { authGuard } from './core/auth';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login').then((m) => m.Login) },
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      {
        path: 'people/:id',
        loadComponent: () => import('./features/person-page').then((m) => m.PersonPage),
      },
      ...(['people', 'raise-requests', 'career-talks', 'tasks'] as const).map((resource) => ({
        path: resource,
        data: { resource },
        loadComponent: () => import('./features/resource-page').then((m) => m.ResourcePage),
      })),
      { path: '', pathMatch: 'full', redirectTo: 'people' },
    ],
  },
  { path: '**', redirectTo: 'people' },
];
