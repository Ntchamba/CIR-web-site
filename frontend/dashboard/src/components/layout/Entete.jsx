// Barre du haut de chaque page : titre, phrase d'introduction, actions.
import { useEffect } from 'react';

export default function Entete({ titre, intro, children }) {
  useEffect(() => { document.title = `${titre} · CIR administration`; }, [titre]);
  return (
    <header className="entete">
      <div>
        <h1>{titre}</h1>
        {intro && <p>{intro}</p>}
      </div>
      {children && <div className="entete-actions">{children}</div>}
    </header>
  );
}
