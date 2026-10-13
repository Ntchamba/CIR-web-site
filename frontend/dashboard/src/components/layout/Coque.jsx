// Coque du tableau de bord : menu latéral sombre + zone de contenu.
import { Outlet } from 'react-router-dom';

import Menu from './Menu.jsx';

export default function Coque() {
  return (
    <div className="coque">
      <div className="coque-menu"><Menu /></div>
      <div className="coque-principal"><Outlet /></div>
    </div>
  );
}
