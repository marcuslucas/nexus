import Dashboard from './screens/Dashboard';

export const navItems = [
  {
    id: 'wm-dashboard',
    label: 'Web Manager',
    icon: 'layout',
    path: '/web-manager',
  },
];

export const routes = [
  { path: '/web-manager', component: Dashboard },
];
