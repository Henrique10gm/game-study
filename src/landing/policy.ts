// The privacy policy page is plain HTML: this only brings the colors and fonts (and keeps
// the day / night choice the visitor made on the landing page).
import '../engine/ui/tokens.css';
import './policy.css';
import { applyTheme, initialTheme } from '../engine/theme';

applyTheme(initialTheme());
