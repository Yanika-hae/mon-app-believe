import { LEGAL_VERSION, PUBLISHER } from './legal'

const TODO = <em>à renseigner par l’éditeur avant toute mise en ligne publique (fichier src/legal.ts)</em>

/** Conditions d’utilisation, politique de confidentialité et transparence sur l’IA. Modèle à faire relire avant publication publique. */
export default function Legal() {
  return (
    <>
      <h1>Informations légales</h1>
      <p className="mut">Version du {LEGAL_VERSION}. Ces textes décrivent ce que fait réellement l’application ; ils sont un modèle à faire relire par un juriste avant une mise en ligne publique.</p>
      <p><b>Éditeur :</b> {PUBLISHER.nom || TODO}.<br /><b>Contact :</b> {PUBLISHER.contact || TODO}.<br /><b>Hébergeur :</b> {PUBLISHER.hebergeur}.</p>

      <details open>
        <summary>Conditions d’utilisation</summary>
        <ol>
          <li><b>Objet.</b> Believe est un outil de suivi personnel : habitudes, sport, santé au quotidien, notes, vie spirituelle, bibliothèque et entraînement à l’éloquence.</li>
          <li><b>Ce que Believe n’est pas.</b> Believe ne fournit aucun avis médical, diététique, psychologique, juridique ni autorité spirituelle. Les calculs (IMC, métabolisme de base, calories, cycle, récupération) sont des estimations. En cas de douleur, de malaise, de trouble alimentaire ou de détresse, contactez un professionnel de santé ou les urgences (112 en Europe ; en France, 15 pour le SAMU et 3114 pour la prévention du suicide).</li>
          <li><b>Contenus générés par IA.</b> Les réponses de Believe AI, les fiches de livres générées, les questions de quiz générées et les images de plats générées peuvent contenir des erreurs. Elles sont toujours signalées « Généré par IA ». Vérifiez avant de vous y fier.</li>
          <li><b>Votre responsabilité.</b> Vous utilisez l’application sous votre responsabilité, y compris pour le sport (écoutez votre corps, consultez un médecin avant un effort intense) et la sécurité de votre appareil (le PIN ne remplace pas le verrouillage de votre téléphone).</li>
          <li><b>Vos contenus.</b> Vos notes, enregistrements et données restent les vôtres. Believe n’en revendique aucun droit.</li>
          <li><b>Œuvres tierces.</b> Les livres et vidéos sont présentés via les sources officielles et légales (liens de lecture ou d’écoute, lecteur YouTube intégré). Believe ne télécharge ni ne reproduit d’œuvres protégées. Les résumés du catalogue sont rédigés pour Believe, ils ne remplacent pas la lecture.</li>
          <li><b>Disponibilité.</b> Le service est fourni en l’état, sans garantie de disponibilité continue ; les fonctions qui dépendent d’un service externe peuvent être indisponibles.</li>
          <li><b>Mineurs.</b> Les moins de 15 ans utilisent Believe avec l’accord d’un parent ou tuteur.</li>
        </ol>
      </details>

      <details>
        <summary>Politique de confidentialité</summary>
        <p><b>Principe.</b> Vos données sont enregistrées sur votre appareil (stockage du navigateur et IndexedDB). Believe n’a pas de base de données d’utilisateurs. Rien n’est envoyé à un service externe sans une action de votre part (envoi d’une question, d’une photo, lancement d’une recherche ou d’une dictée) et, pour l’IA, les photos et la dictée vocale, sans votre accord préalable.</p>
        <table className="t">
          <thead><tr><th>Donnée</th><th>Où elle est conservée</th><th>Envoyée à un tiers ?</th></tr></thead>
          <tbody>
            <tr><td>Profil, habitudes, tâches, notes, prières, livres, scores, réglages</td><td>Sur l’appareil</td><td>Non</td></tr>
            <tr><td>Poids, repas, eau, sommeil, cycle ou récupération (données de santé)</td><td>Sur l’appareil, après votre accord « Santé et poids »</td><td>Non (sauf si vous cochez « inclure mon contexte » dans Believe AI : âge, taille, poids, niveau)</td></tr>
            <tr><td>Enregistrements audio</td><td>Sur l’appareil (IndexedDB)</td><td>Non</td></tr>
            <tr><td>Position GPS</td><td>Lue pendant la séance, tracé gardé en mémoire ; seul le résumé est enregistré</td><td>Non</td></tr>
            <tr><td>Mouvement (podomètre)</td><td>Total de pas du jour</td><td>Non</td></tr>
            <tr><td>Rappels de tâches (si vous les activez)</td><td>Sur l’appareil : le calcul se fait dans l’application, sans serveur de notifications. Le titre de la tâche est affiché par le système de l’appareil, remplacé par un texte neutre en mode discret ou sous l’écran du PIN</td><td>Non</td></tr>
            <tr><td>Questions à Believe AI, photos de plats ou de frigo (réduites sur l’appareil), notes soumises à l’IA après relecture, texte de recherche</td><td>Non conservés par Believe</td><td>Oui : serveur Believe, puis Google (API Gemini) ; recherche : YouTube, Open Library, Google Books, Gutenberg, LibriVox</td></tr>
            <tr><td>Titre et ingrédients d’une recette, si vous demandez l’image du plat</td><td>Non conservés par Believe ; l’image reçue reste en mémoire le temps de la liste de recettes, elle n’est jamais enregistrée</td><td>Oui : serveur Believe, puis Google (API Gemini, modèle d’image)</td></tr>
            <tr><td>Lecture vidéo et couvertures de livres</td><td>—</td><td>Oui : YouTube (domaine sans cookies) et sites des catalogues reçoivent votre adresse IP à l’affichage</td></tr>
            <tr><td>Dictée vocale de vos questions à Believe AI (si vous l’activez ; une phrase à chaque appui sur « Dicter »)</td><td>Believe ne garde aucun son. Le texte reconnu est ajouté au champ de votre question, sur l’appareil, et ne part vers l’IA que si vous appuyez sur « Envoyer »</td><td>Oui, par le navigateur et non par Believe : selon le navigateur et l’appareil, le son est envoyé à Google (Chrome) ou à Apple (Safari) pour être transcrit. Believe ne reçoit que le texte</td></tr>
          </tbody>
        </table>
        <p><b>Bases légales.</b> Votre consentement (RGPD art. 6.1.a et, pour les données de santé, art. 9.2.a), que vous pouvez retirer à tout moment dans la rubrique 5 ; la sécurité du service (limitation des abus, contrôle d’accès).</p>
        <p><b>Durées.</b> Sur l’appareil, jusqu’à ce que vous les supprimiez. Believe n’écrit aucun journal applicatif des contenus échangés ; l’hébergeur peut conserver des journaux techniques standard (adresse IP, date, adresse appelée). Google conserve les échanges d’IA selon les conditions de l’offre associée à la clé du serveur.</p>
        <p><b>Destinataires et transferts.</b> Google (IA, YouTube, Google Books ; reconnaissance vocale de Chrome si vous dictez), Apple (reconnaissance vocale de Safari si vous dictez), Vercel (hébergement), Internet Archive (Open Library), Project Gutenberg, LibriVox. Certains sont situés aux États-Unis ; reportez-vous aux garanties qu’ils publient pour les transferts hors Union européenne.</p>
        <p><b>Vos droits.</b> Accès et portabilité (export JSON, rubrique 5), rectification (vous modifiez vos données), effacement (« Tout supprimer »), limitation et opposition, retrait du consentement. Pour toute demande qui ne se règle pas dans l’application : {PUBLISHER.contact || TODO}. Vous pouvez saisir la CNIL (cnil.fr).</p>
        <p><b>Sécurité.</b> Connexion chiffrée (HTTPS), clés d’API conservées uniquement sur le serveur, accès aux fonctions serveur contrôlé, PIN à 4 chiffres haché et salé avec limitation des essais. Le PIN verrouille l’interface : il ne chiffre pas le stockage du navigateur.</p>
        <p><b>Traceurs.</b> Aucun cookie publicitaire, aucune mesure d’audience. Le stockage local sert au fonctionnement. YouTube peut déposer des traceurs lorsque vous lancez une vidéo.</p>
        <p><b>Partage avec des amis.</b> Il n’a lieu que sur votre action (image ou texte partagé depuis votre appareil). Les données sensibles sont masquées par défaut et certaines ne sont jamais partageables (valeurs de poids, cycle ou récupération, journal alimentaire, sujets de prière, notes, tracé GPS).</p>
      </details>

      <details>
        <summary>Transparence sur l’intelligence artificielle</summary>
        <ul>
          <li>Believe AI est un système d’intelligence artificielle fondé sur un modèle de Google (API Gemini). Vous échangez avec une machine, pas avec une personne.</li>
          <li>Tout contenu généré (réponses, encouragements, fiches de livres, questions de quiz, conseils, images de plats) est étiqueté « Généré par IA » et distinct du texte biblique, du catalogue ou de vos propres notes.</li>
          <li>Les images de plats sont des illustrations créées par un modèle d’image de Google, à la demande, d’après le titre et les ingrédients de la recette seulement ; elles portent un filigrane invisible (SynthID) et peuvent différer du plat réel.</li>
          <li>Les réponses peuvent être fausses, incomplètes ou inadaptées. Elles ne remplacent ni un médecin, ni un diététicien, ni un psychologue, ni un conseiller spirituel.</li>
          <li>Aucune décision automatique n’est prise à votre place : les estimations de repas se valident avant d’être ajoutées, les questions générées sont signalées comme non vérifiées.</li>
          <li>Vous gardez la maîtrise : l’accord à l’IA et l’accord pour les photos se retirent à tout moment ; aucun envoi n’a lieu sans votre action.</li>
        </ul>
      </details>
      <p><a href="#/5/confidentialite">Retour à la rubrique 5</a></p>
    </>
  )
}
