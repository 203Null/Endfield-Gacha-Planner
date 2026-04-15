import './styles/planner.css';
import WeaponApp from './WeaponApp.svelte';

const app = new WeaponApp({
  target: document.getElementById('app'),
});

export default app;