import '@fontsource-variable/inter';
import { render } from 'solid-js/web';

import App from './App';
import './styles/app.scss';

const root: HTMLElement | null = document.getElementById('root');

if (!root) throw new Error('Wayfinding Studio root element is missing.');

render(() => <App />, root);
