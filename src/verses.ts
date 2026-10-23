/**
 * Versets du jour (rubrique 4), séparés du reste des données pour pouvoir être contrôlés seuls.
 *
 * Sources : textes copiés depuis les éditions numériques intégrales de la Bible Louis Segond 1910 et de la Bible Martin 1744, toutes deux dans le domaine public
 * (dépôt ouvert « Holy-Bible-XML-Format »). `npm run verify:verses` compare chaque verset à ces éditions, mot pour mot ; elle échoue au moindre écart.
 *
 * Seules retouches typographiques admises : apostrophe courbe (’), « Éternel » avec sa majuscule accentuée, ligature « cœur » / « œuvre », « Ô » initial,
 * et, pour la Martin, suppression des crochets qui signalent les mots ajoutés par les traducteurs.
 *
 * Références : numérotation française imprimée. Pour certains psaumes, l'édition numérique compte le titre dans le verset 1 : le décalage est connu du script de contrôle.
 * Suffixe « a » : début du verset, jusqu'à une fin de phrase ; suffixe « b » : fin du verset, à partir d'un début de phrase ; l'intitulé d'un psaume est omis sans suffixe.
 * Un « … » final remplace la virgule, le point-virgule ou les deux-points qui terminent le texte source quand le verset continue.
 * Proverbes 27:17 est donné d'après la Martin : la Segond 1910 y parle de « colère » et non d'un fer qui aiguise la face d'un ami.
 */
export type TrKey = 'LSG' | 'MAR'
/** Verset : référence, texte, traduction (Louis Segond 1910 si elle n'est pas indiquée). */
export type Verse = readonly [ref: string, text: string, tr?: TrKey]

export const TR: Record<TrKey, string> = { LSG: 'Louis Segond 1910', MAR: 'Martin 1744' }
/** Traduction d'un verset, avec son statut : affichée sous chaque verset. */
export const trLabel = (v: Verse) => TR[v[2] ?? 'LSG'] + ' (domaine public)'

/** Noms lus à voix haute pour les livres numérotés (« 1 Jean » serait lu « un Jean »). */
const SPOKEN: Record<string, string> = {
  '1 Samuel': 'Premier livre de Samuel', '1 Rois': 'Premier livre des Rois', '1 Corinthiens': 'Première épître aux Corinthiens', '1 Timothée': 'Première épître à Timothée',
  '2 Timothée': 'Deuxième épître à Timothée', '1 Pierre': 'Première épître de Pierre', '1 Jean': 'Première épître de Jean'
}
/** Référence prononcée : « Psaume 46, verset 6 » ; « Proverbes, chapitre 31, verset 25 » ; « première partie » ou « seconde partie » pour un suffixe a ou b. */
export const refSpoken = (ref: string) => {
  const m = /^(.+) (\d+):(\d+)([ab])?$/.exec(ref)
  if (!m) return ref
  const part = m[4] === 'a' ? ', première partie' : m[4] === 'b' ? ', seconde partie' : ''
  return (m[1] === 'Psaume' ? 'Psaume ' + m[2] : (SPOKEN[m[1]] ?? m[1]) + ', chapitre ' + m[2]) + ', verset ' + m[3] + part
}

/** Profil Femme : force, grâce, dignité, sagesse, foi, persévérance, pardon, repentance, motivation (avec Esther, Débora, Ruth, Anne). */
export const VF: readonly Verse[] = [
  ['Proverbes 31:25', 'Elle est revêtue de force et de gloire, Et elle se rit de l’avenir.'],
  ['Proverbes 31:30', 'La grâce est trompeuse, et la beauté est vaine; La femme qui craint l’Éternel est celle qui sera louée.'],
  ['Psaume 46:6', 'Dieu est au milieu d’elle: elle n’est point ébranlée; Dieu la secourt dès l’aube du matin.'],
  ['Ésaïe 40:31', 'Mais ceux qui se confient en l’Éternel renouvellent leur force. Ils prennent le vol comme les aigles; Ils courent, et ne se lassent point, Ils marchent, et ne se fatiguent point.'],
  ['Ésaïe 41:10', 'Ne crains rien, car je suis avec toi; Ne promène pas des regards inquiets, car je suis ton Dieu; Je te fortifie, je viens à ton secours, Je te soutiens de ma droite triomphante.'],
  ['Ésaïe 43:1b', 'Ne crains rien, car je te rachète, Je t’appelle par ton nom: tu es à moi!'],
  ['Sophonie 3:17', 'L’Éternel, ton Dieu, est au milieu de toi, comme un héros qui sauve; Il fera de toi sa plus grande joie; Il gardera le silence dans son amour; Il aura pour toi des transports d’allégresse.'],
  ['Psaume 139:14', 'Je te loue de ce que je suis une créature si merveilleuse. Tes œuvres sont admirables, Et mon âme le reconnaît bien.'],
  ['Luc 1:45', 'Heureuse celle qui a cru, parce que les choses qui lui ont été dites de la part du Seigneur auront leur accomplissement.'],
  ['Luc 1:37', 'Car rien n’est impossible à Dieu.'],
  ['Marc 5:34b', 'Ma fille, ta foi t’a sauvée; va en paix, et sois guérie de ton mal.'],
  ['Joël 2:13', 'Déchirez vos cœurs et non vos vêtements, Et revenez à l’Éternel, votre Dieu; Car il est compatissant et miséricordieux, Lent à la colère et riche en bonté, Et il se repent des maux qu’il envoie.'],
  ['Éphésiens 2:8', 'Car c’est par la grâce que vous êtes sauvés, par le moyen de la foi. Et cela ne vient pas de vous, c’est le don de Dieu.'],
  ['Philippiens 4:13', 'Je puis tout par celui qui me fortifie.'],
  ['Jérémie 29:11', 'Car je connais les projets que j’ai formés sur vous, dit l’Éternel, projets de paix et non de malheur, afin de vous donner un avenir et de l’espérance.'],
  ['Proverbes 3:6', 'Reconnais-le dans toutes tes voies, Et il aplanira tes sentiers.'],
  ['Jacques 1:5', 'Si quelqu’un d’entre vous manque de sagesse, qu’il la demande à Dieu, qui donne à tous simplement et sans reproche, et elle lui sera donnée.'],
  ['Psaume 126:5', 'Ceux qui sèment avec larmes Moissonneront avec chants d’allégresse.'],
  ['Galates 6:9', 'Ne nous lassons pas de faire le bien; car nous moissonnerons au temps convenable, si nous ne nous relâchons pas.'],
  ['1 Jean 1:9', 'Si nous confessons nos péchés, il est fidèle et juste pour nous les pardonner, et pour nous purifier de toute iniquité.'],
  ['Colossiens 3:13', 'Supportez-vous les uns les autres, et, si l’un a sujet de se plaindre de l’autre, pardonnez-vous réciproquement. De même que Christ vous a pardonné, pardonnez-vous aussi.'],
  ['Psaume 103:12', 'Autant l’orient est éloigné de l’occident, Autant il éloigne de nous nos transgressions.'],
  ['Psaume 51:12', 'Ô Dieu! crée en moi un cœur pur, Renouvelle en moi un esprit bien disposé.'],
  ['Psaume 34:19', 'L’Éternel est près de ceux qui ont le cœur brisé, Et il sauve ceux qui ont l’esprit dans l’abattement.'],
  ['Esther 4:14b', 'Et qui sait si ce n’est pas pour un temps comme celui-ci que tu es parvenue à la royauté?'],
  ['Ruth 1:16b', 'Où tu iras j’irai, où tu demeureras je demeurerai; ton peuple sera mon peuple, et ton Dieu sera mon Dieu…'],
  ['Juges 5:7', 'Les chefs étaient sans force en Israël, sans force, Quand je me suis levée, moi, Débora, Quand je me suis levée comme une mère en Israël.'],
  ['1 Samuel 2:1b', 'Mon cœur se réjouit en l’Éternel, Ma force a été relevée par l’Éternel; Ma bouche s’est ouverte contre mes ennemis, Car je me réjouis de ton secours.'],
]

/** Profil Homme : courage, leadership, maîtrise de soi, persévérance, amitié (avec David, Daniel, Gédéon, Joseph). */
export const VM: readonly Verse[] = [
  ['Josué 1:9', 'Ne t’ai-je pas donné cet ordre: Fortifie-toi et prends courage? Ne t’effraie point et ne t’épouvante point, car l’Éternel, ton Dieu, est avec toi dans tout ce que tu entreprendras.'],
  ['1 Corinthiens 16:13', 'Veillez, demeurez fermes dans la foi, soyez des hommes, fortifiez-vous.'],
  ['Psaume 144:1', 'Béni soit l’Éternel, mon rocher, Qui exerce mes mains au combat, Mes doigts à la bataille…'],
  ['Proverbes 27:17', 'Comme le fer aiguise le fer, ainsi l’homme aiguise la face de son ami.', 'MAR'],
  ['Juges 6:12b', 'L’Éternel est avec toi, vaillant héros!'],
  ['Juges 6:14b', 'Va avec cette force que tu as, et délivre Israël de la main de Madian; n’est-ce pas moi qui t’envoie?'],
  ['1 Samuel 17:45b', 'Tu marches contre moi avec l’épée, la lance et le javelot; et moi, je marche contre toi au nom de l’Éternel des armées, du Dieu de l’armée d’Israël, que tu as insultée.'],
  ['Daniel 1:8', 'Daniel résolut de ne pas se souiller par les mets du roi et par le vin dont le roi buvait, et il pria le chef des eunuques de ne pas l’obliger à se souiller.'],
  ['Proverbes 16:32', 'Celui qui est lent à la colère vaut mieux qu’un héros, Et celui qui est maître de lui-même, que celui qui prend des villes.'],
  ['Proverbes 25:28', 'Comme une ville forcée et sans murailles, Ainsi est l’homme qui n’est pas maître de lui-même.'],
  ['Proverbes 4:23', 'Garde ton cœur plus que toute autre chose, Car de lui viennent les sources de la vie.'],
  ['Proverbes 14:29', 'Celui qui est lent à la colère a une grande intelligence, Mais celui qui est prompt à s’emporter proclame sa folie.'],
  ['2 Timothée 1:7', 'Car ce n’est pas un esprit de timidité que Dieu nous a donné, mais un esprit de force, d’amour et de sagesse.'],
  ['Deutéronome 31:6', 'Fortifiez-vous et ayez du courage! Ne craignez point et ne soyez point effrayés devant eux; car l’Éternel, ton Dieu, marchera lui-même avec toi, il ne te délaissera point, il ne t’abandonnera point.'],
  ['1 Rois 2:2b', 'Fortifie-toi, et sois un homme!'],
  ['Josué 24:15b', 'Moi et ma maison, nous servirons l’Éternel.'],
  ['1 Timothée 4:12', 'Que personne ne méprise ta jeunesse; mais sois un modèle pour les fidèles, en parole, en conduite, en charité, en foi, en pureté.'],
  ['Éphésiens 6:10', 'Au reste, fortifiez-vous dans le Seigneur, et par sa force toute-puissante.'],
  ['2 Timothée 4:7', 'J’ai combattu le bon combat, j’ai achevé la course, j’ai gardé la foi.'],
  ['Jacques 1:12', 'Heureux l’homme qui supporte patiemment la tentation; car, après avoir été éprouvé, il recevra la couronne de vie, que le Seigneur a promise à ceux qui l’aiment.'],
  ['Psaume 31:25', 'Fortifiez-vous et que votre cœur s’affermisse, Vous tous qui espérez en l’Éternel!'],
  ['Psaume 27:14', 'Espère en l’Éternel! Fortifie-toi et que ton cœur s’affermisse! Espère en l’Éternel!'],
  ['Psaume 18:2b', 'Je t’aime, ô Éternel, ma force!'],
  ['Ecclésiaste 4:9', 'Deux valent mieux qu’un, parce qu’ils retirent un bon salaire de leur travail.'],
  ['Ésaïe 40:29', 'Il donne de la force à celui qui est fatigué, Et il augmente la vigueur de celui qui tombe en défaillance.'],
  ['1 Pierre 5:8', 'Soyez sobres, veillez. Votre adversaire, le diable, rôde comme un lion rugissant, cherchant qui il dévorera.'],
  ['Proverbes 18:10', 'Le nom de l’Éternel est une tour forte; Le juste s’y réfugie, et se trouve en sûreté.'],
  ['Exode 14:14', 'L’Éternel combattra pour vous; et vous, gardez le silence.'],
  ['Genèse 39:9b', 'Comment ferais-je un aussi grand mal et pécherais-je contre Dieu?'],
]
