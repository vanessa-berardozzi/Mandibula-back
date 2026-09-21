/**
 * Seed des guides d'élevage (Mandibula Academy).
 * Idempotent : les guides sont upsertés par slug et leurs blocs enfants régénérés.
 *
 * Exécution : pnpm prisma:seed:guides
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquante dans .env');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface GuideSeedSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  warning?: string;
}

interface GuideSeed {
  slug: string;
  category: string;
  title: string;
  summary: string;
  readingTime: string;
  level: string;
  intro: string;
  recap: { summary: string; points: string[] };
  /** [label, valeur, note] */
  facts: [string, string, string][];
  sections: GuideSeedSection[];
  sources: { label: string; href: string }[];
  visuals: { src: string; alt: string; caption: string }[];
}

const GUIDES: GuideSeed[] = [
  {
    slug: 'demarrer-elevage-isopodes',
    category: 'Bien débuter',
    title: 'Démarrer un élevage d’isopodes',
    summary:
      'Le guide complet pour installer une première colonie, lire le bac et construire un milieu durable.',
    readingTime: '14 min',
    level: 'Débutant',
    intro:
      'Un bon élevage d’isopodes ne dépend pas d’un matériel complexe : il dépend d’un milieu vivant, stable et lisible. Avant de chercher à faire reproduire une colonie, offrez-lui de la nourriture permanente, des cachettes, un vrai gradient d’humidité et du temps pour s’installer.',
    recap: {
      summary:
        'Créer un milieu stable avec un substrat nourrissant, une litière permanente et un véritable gradient d’humidité. L’animal doit pouvoir choisir entre une zone humide et une zone mieux ventilée.',
      points: [
        'Aérations latérales protégées',
        'Feuilles et bois décomposé disponibles',
        'Mousse concentrée sur la zone humide',
        'Source de calcium permanente',
      ],
    },
    facts: [
      ['Substrat', '6–10 cm', 'point de départ'],
      ['Zone humide', '≈ 1/3', 'à adapter'],
      ['Contrôle', '2× / semaine', 'minimum'],
    ],
    sections: [
      {
        title: 'Avant d’adopter : choisir l’espèce et préparer son projet',
        paragraphs: [
          'Tous les isopodes ne vivent pas dans les mêmes conditions. Certaines espèces méditerranéennes apprécient un bac globalement sec avec un refuge humide ; d’autres demandent un substrat plus humide tout en restant aéré. La fiche de l’espèce reste toujours prioritaire.',
          'Pour débuter, préférez une espèce robuste, bien établie en élevage et dont les paramètres sont documentés. Prévoyez aussi ce que deviendra une colonie qui se porte bien : elle peut grandir, nécessiter un bac plus grand ou être divisée. L’adoption d’un vivant engage une préparation avant son arrivée.',
        ],
        bullets: [
          'Vérifier l’origine, la taille adulte et le niveau de ventilation attendu.',
          'Préparer le bac avant la réception, jamais dans l’urgence.',
          'Éviter de mélanger des espèces aux besoins différents.',
          'Choisir un emplacement calme, sans soleil direct et sans chaleur instable.',
        ],
      },
      {
        title: 'Le matériel utile — simple, mais cohérent',
        paragraphs: [
          'Une boîte avec couvercle, quelques aérations protégées par une maille fine, un pulvérisateur et une sonde de température suffisent pour commencer. Le volume doit laisser de la place au substrat, à la litière et à l’évolution de la colonie : une très petite boîte se dérègle vite.',
          'Le cœur du dispositif n’est pas le plastique, mais ce qu’il contient : substrat organique nourrissant, litière généreuse de feuilles mortes, bois décomposé, écorces de liège et source de calcium. Ces éléments forment à la fois des réserves de nourriture, des refuges et des microclimats.',
        ],
        bullets: [
          'Bac avec aérations adaptées à l’espèce.',
          'Substrat profond, souple et non traité.',
          'Feuilles mortes et bois réellement décomposé disponibles en continu.',
          'Liège et mousse concentrés vers le refuge humide.',
          'Calcium propre et accessible en permanence.',
        ],
      },
      {
        title: 'Installer le bac : construire un gradient, pas une mare',
        paragraphs: [
          'Mettez plusieurs centimètres de substrat sans le tasser. Humidifiez nettement une extrémité, idéalement sous une écorce ou une mousse, puis laissez l’autre partie plus sèche. Cette différence donne aux animaux le choix de leur microclimat.',
          'Recouvrez largement la surface de feuilles. Elles limitent l’évaporation, protègent les jeunes, nourrissent la colonie et évitent de laisser le sol à nu. Les écorces placées à cheval sur les deux zones créent déjà des conditions intermédiaires.',
        ],
        warning:
          'Un bac uniformément mouillé est plus difficile à stabiliser qu’un bac avec un refuge humide et une vraie zone plus sèche. Humide ne veut jamais dire saturé ou sans circulation d’air.',
      },
      {
        title: 'L’arrivée de la colonie : observer sans déranger',
        paragraphs: [
          'Déposez les isopodes doucement avec un peu de leur ancien substrat lorsque c’est possible. Les premiers jours, ne retournez pas les cachettes : ils découvrent le milieu et peuvent rester invisibles. L’absence d’animaux en surface n’est pas, à elle seule, un signe de problème.',
          'Une à deux observations brèves par semaine suffisent au départ. Regardez l’état de la mousse, le toucher du substrat, les restes de nourriture, la condensation et la répartition des animaux. Ces repères sont plus utiles qu’une surveillance permanente.',
        ],
      },
      {
        title: 'Les premières semaines : une routine qui protège le milieu',
        paragraphs: [
          'Un élevage se stabilise grâce à de petites actions répétées. Maintenez les feuilles et le bois ; ajoutez les aliments frais ou protéinés en très petite quantité ; retirez ce qui fermente. Les apports doivent suivre la consommation réelle, pas un calendrier rigide.',
          'La température ambiante stable est généralement préférable à une source de chaleur poussée sans nécessité. Gardez les bacs loin d’une fenêtre, d’un radiateur ou d’un endroit où le soleil peut les atteindre.',
        ],
        bullets: [
          'Vérifier deux fois par semaine l’humidité du refuge et l’odeur du bac.',
          'Ajouter les feuilles avant que la surface soit entièrement consommée.',
          'Retirer les restes frais dès qu’ils se dégradent.',
          'Adapter eau et ventilation progressivement : un seul réglage à la fois.',
        ],
      },
      {
        title: 'Quand faut-il intervenir ?',
        paragraphs: [
          'De petites moisissures blanches peuvent apparaître dans un milieu jeune et riche en matière organique. Avant de tout refaire, vérifiez les excès : nourriture trop abondante, surface constamment mouillée, manque d’air ou zone sèche inexistante.',
          'Une odeur aigre, un substrat noir et compact, de la condensation permanente ou des décès répétés sont en revanche des signaux d’alerte. Retirez les déchets, corrigez progressivement et revenez à la fiche de l’espèce avant de multiplier les changements.',
        ],
      },
    ],
    sources: [
      {
        label: 'Ashopods — guide de maintenance des isopodes',
        href: 'https://www.ashopods.com/isopodcare',
      },
      {
        label: 'HVR Reptile & Rescue — rôle des isopodes dans un milieu bioactif',
        href: 'https://www.hvreptilerescue.org/resources/bioactive-guide/the-clean-up-crew',
      },
    ],
    visuals: [
      {
        src: 'https://images.sumup.com/img_4BS96M21D08CVV1HR4DWDV02S3',
        alt: 'Substrat premium pour isopodes',
        caption: 'Un substrat organique constitue la base nutritive du bac.',
      },
      {
        src: 'https://images.sumup.com/img_39DCXRXVWA8F4S2B60MTWR2CTJ',
        alt: 'Cubaris murina Glacier',
        caption: 'Chaque espèce impose ensuite ses propres réglages.',
      },
    ],
  },
  {
    slug: 'gradient-humidite-isopodes',
    category: 'Techniques d’élevage',
    title: 'Comprendre le gradient d’humidité',
    summary:
      'Apprendre à lire l’humidité, la ventilation et le comportement de la colonie plutôt qu’un chiffre isolé.',
    readingTime: '12 min',
    level: 'Débutant',
    intro:
      'Le gradient d’humidité est l’outil le plus utile pour un élevage d’isopodes. Au lieu d’imposer une condition identique à toute la boîte, il offre plusieurs microclimats afin que chaque individu puisse choisir le refuge qui lui convient.',
    recap: {
      summary:
        'L’objectif n’est pas d’obtenir un chiffre uniforme, mais plusieurs microclimats dans le même bac. La répartition des animaux, l’état du substrat et la condensation sont de meilleurs indicateurs qu’une mesure isolée.',
      points: [
        'Zone humide stable, jamais noyée',
        'Zone plus sèche correctement ventilée',
        'Condensation uniquement ponctuelle',
        'Une seule correction à la fois',
      ],
    },
    facts: [
      ['Mesure', 'dans le substrat', 'pas seulement l’air'],
      ['Condensation', 'ponctuelle', 'pas permanente'],
      ['Correction', '1 paramètre', 'à la fois'],
    ],
    sections: [
      {
        title: 'Pourquoi un gradient est plus fiable qu’une humidité uniforme',
        paragraphs: [
          'Les besoins changent au cours de la journée, avec la taille, l’état de mue et l’espèce. Une même colonie peut utiliser la mousse humide pour se replier, puis explorer la litière plus sèche la nuit. Un bac uniforme oblige les animaux à subir un seul réglage.',
          'Le gradient n’est pas seulement une partie mouillée et une partie sèche. Les feuilles, les écorces et la profondeur du substrat créent des zones intermédiaires. C’est cette diversité qui rend le bac plus tolérant et plus facile à lire.',
        ],
      },
      {
        title: 'Construire les zones sans compliquer le bac',
        paragraphs: [
          'Choisissez une extrémité comme refuge humide. Sous une écorce, humidifiez le substrat en profondeur et placez-y la mousse. L’autre extrémité reste plus sèche : elle ne reçoit pas d’eau à chaque entretien et bénéficie davantage des aérations.',
          'Arrosez le substrat, pas les animaux. L’objectif est une humidité qui tient dans le temps, non une surface brillante juste après une pulvérisation.',
        ],
        bullets: [
          'Refuge humide : substrat sombre et souple, sans eau libre.',
          'Zone sèche : litière sèche en surface, sol non poussiéreux en profondeur.',
          'Cachettes sur les deux zones pour multiplier les microclimats.',
          'Aérations qui renouvellent l’air sans assécher brutalement le refuge.',
        ],
      },
      {
        title: 'Les signaux d’un milieu trop sec',
        paragraphs: [
          'Un substrat qui se rétracte contre les parois, une mousse cassante ou une litière poussiéreuse indiquent que l’eau ne tient plus assez. Les animaux peuvent se concentrer durablement sous le seul coin humide.',
          'Avant d’augmenter l’eau partout, vérifiez la logique du bac : le refuge est-il assez profond ? Les feuilles couvrent-elles encore la surface ? Les aérations sont-elles disproportionnées ? Corrigez le refuge en premier, puis observez plusieurs jours.',
        ],
      },
      {
        title: 'Les signaux d’un milieu trop humide',
        paragraphs: [
          'Condensation permanente sur toutes les parois, sol tassé et sombre, odeur aigre ou aliments qui fondent rapidement sont plus parlants qu’un hygromètre seul. Une population regroupée en hauteur peut aussi signaler que les niveaux bas sont trop saturés.',
          'Retirez les restes de nourriture, arrêtez d’arroser la zone sèche, ajoutez de la litière sèche et augmentez très progressivement l’échange d’air. Gardez toujours le petit refuge réellement humide.',
        ],
        warning:
          'La condensation est un indice, pas une condamnation. Elle peut apparaître après un arrosage ou un changement de température. Ce qui compte est son caractère durable, l’odeur du bac et l’état du substrat.',
      },
      {
        title: 'Ventilation et méthode de correction',
        paragraphs: [
          'L’aération ne sert pas à assécher la colonie, mais à renouveler les gaz et à limiter l’air stagnant. Sa surface doit être adaptée à l’espèce, au volume, à la température et à l’humidité réelle de la pièce.',
          'Quand un bac semble déréglé, modifiez un seul facteur : eau, aération, litière ou emplacement. Attendez ensuite de voir la réponse de la colonie. Plusieurs grandes corrections simultanées rendent l’origine du problème impossible à comprendre.',
        ],
        bullets: [
          'Identifier le problème à partir de plusieurs signes, jamais d’un seul chiffre.',
          'Modifier un seul paramètre.',
          'Observer l’état du sol et la répartition des animaux.',
          'Revenir à la fiche d’espèce si l’inconfort persiste.',
        ],
      },
    ],
    sources: [
      {
        label: 'PostPods — principes de gradient d’humidité selon les groupes d’isopodes',
        href: 'https://postpods.co.uk/blogs/isopods-useful-articles/humidity-for-isopods',
      },
      {
        label: 'Ashopods — humidité, ventilation et microclimats',
        href: 'https://www.ashopods.com/isopodcare',
      },
    ],
    visuals: [
      {
        src: 'https://images.sumup.com/img_739KRRWANC8D1A7MATD3WBAJ79',
        alt: 'Ardentiella sp. Blister',
        caption: 'Les espèces tropicales utilisent des microclimats très humides.',
      },
      {
        src: 'https://images.sumup.com/img_0JH1G56WYQ8K5BWR09MYVVZ8WZ',
        alt: 'Ardentiella sp. Quadcolor',
        caption: 'Humide ne signifie pas saturé : l’air doit continuer de circuler.',
      },
    ],
  },
  {
    slug: 'substrat-isopodes',
    category: 'Milieux & bioactivité',
    title: 'Construire un substrat vivant et durable',
    summary:
      'Le rôle du bois, des feuilles, de la structure, de l’humidité et des apports minéraux dans un bac d’isopodes.',
    readingTime: '15 min',
    level: 'Intermédiaire',
    intro:
      'Pour les isopodes, le substrat n’est pas une décoration. C’est un garde-manger, une réserve d’eau, un lieu de mue et un habitat pour une grande partie de la vie invisible du bac. Le construire durablement évite les remplacements complets et les dérèglements inutiles.',
    recap: {
      summary:
        'Le substrat est à la fois un habitat, une réserve d’humidité et la principale ressource alimentaire. Il doit rester riche, poreux et vivant, sans devenir compact ou boueux.',
      points: [
        'Matière réellement décomposée',
        'Structure poreuse et non compacte',
        'Litière toujours présente en surface',
        'Renouvellement partiel uniquement',
      ],
    },
    facts: [
      ['Profondeur', '6–10 cm', 'selon espèce'],
      ['Litière', 'permanente', 'jamais à nu'],
      ['Renouvellement', 'partiel', 'conserver l’ancien'],
    ],
    sections: [
      {
        title: 'Les quatre missions du substrat',
        paragraphs: [
          'Un bon mélange doit nourrir, retenir une partie de l’eau, rester poreux et offrir des refuges. S’il est uniquement riche mais compact, il risque de s’asphyxier ; s’il est uniquement fibreux et pauvre, il ne nourrit pas réellement la colonie.',
        ],
        bullets: [
          'Nourrir : feuilles mortes, humus et bois déjà décomposé.',
          'Structurer : éléments de tailles variées qui limitent le tassement.',
          'Tamponner : retenir l’eau dans le refuge sans faire de boue.',
          'Abriter : créer des zones pour les mues, les jeunes et la microfaune.',
        ],
      },
      {
        title: 'Feuilles mortes : une ressource permanente',
        paragraphs: [
          'Une couche de feuilles de feuillus nourrit, retient l’humidité en surface, protège les petits individus et permet aux isopodes de se déplacer sans être exposés. Gardez-en continuellement, même si le substrat paraît déjà riche.',
          'Utilisez des feuilles propres, sèches, identifiées et récoltées loin des zones traitées. Évitez les végétaux parfumés, résineux ou suspects. Une matière végétale sûre et variée est plus utile qu’une grande quantité d’un élément dont vous ne connaissez pas la provenance.',
        ],
      },
      {
        title: 'Bois décomposé : pourquoi le bois frais ne suffit pas',
        paragraphs: [
          'Le bois recherché est friable, déjà travaillé par la décomposition et facilement intégrable au mélange. Il apporte une ressource alimentaire longue durée et une texture que les isopodes utilisent dans le sol. Des copeaux ou du bois frais ne proposent pas la même valeur.',
          'Ajoutez du bois en morceaux et en miettes, puis conservez-en également sous les feuilles. Les espèces fouisseuses profiteront de ce qui est mélangé au sol ; les autres utiliseront volontiers les fragments de surface.',
        ],
      },
      {
        title: 'Retenir l’eau sans étouffer le milieu',
        paragraphs: [
          'Le sol doit s’émietter entre les doigts, garder une humidité profonde dans le refuge et ne jamais devenir une masse lisse et gorgée d’eau. Une variété de particules organiques et minérales aide à préserver des espaces d’air.',
          'Évitez de compacter le mélange lors de la mise en place. Si le bac se tasse avec le temps, réintroduisez en surface de la matière structurante plutôt que de retourner toute la colonie.',
        ],
      },
      {
        title: 'Calcium, argile et biochar : des compléments, pas la base',
        paragraphs: [
          'Une source de calcium propre et accessible complète le milieu, notamment autour des mues. L’argile ou d’autres éléments minéraux peuvent participer à la texture, mais aucun ne compense un manque de litière, de bois ou de matière organique.',
          'Le biochar horticole, lorsqu’il est propre et utilisé avec mesure, peut être un élément de structure intéressant. Il ne doit pas devenir la base du substrat ni remplacer le bois décomposé ou les feuilles.',
        ],
      },
      {
        title: 'Entretenir sans remettre le compteur à zéro',
        paragraphs: [
          'Un sol vivant n’a pas besoin d’être stérile. Ajoutez feuilles et bois en surface, surveillez les zones qui s’appauvrissent et remplacez une partie du mélange seulement lorsqu’il est réellement dégradé ou compact. Conserver une fraction de l’ancien substrat aide le nouveau mélange à retrouver son équilibre biologique.',
        ],
        bullets: [
          'Ne jamais vider brutalement un bac qui fonctionne.',
          'Renouveler localement et progressivement.',
          'Préserver cachettes et refuge humide pendant l’intervention.',
          'Écarter tout apport avec engrais, pesticide, parfum ou traitement antifongique.',
        ],
      },
    ],
    sources: [
      {
        label: 'Scuttle & Squeak — rôle de la litière, du bois et du calcium',
        href: 'https://scuttleandsqueak.com/care-guides/isopods/porcellio-hoffmannseggi',
      },
      {
        label: 'Ashopods — substrat, feuilles et bois décomposé',
        href: 'https://www.ashopods.com/isopodcare',
      },
    ],
    visuals: [
      {
        src: 'https://images.sumup.com/img_0Q6M86FFKN86ZBA5VNB7G6FNZE',
        alt: 'Bois blanc décomposé',
        caption: 'Le bois blanc friable est déjà colonisé et facilement consommable.',
      },
      {
        src: 'https://images.sumup.com/img_4BS96M21D08CVV1HR4DWDV02S3',
        alt: 'Substrat premium isopode',
        caption: 'Le mélange final doit rester poreux, nourrissant et stable.',
      },
    ],
  },
  {
    slug: 'nourrir-isopodes',
    category: 'Bien débuter',
    title: 'Nourrir sans surcharger',
    summary:
      'Une méthode claire pour distinguer l’alimentation de fond, les compléments et les signaux d’un excès.',
    readingTime: '12 min',
    level: 'Débutant',
    intro:
      'La meilleure façon de nourrir une colonie est d’abord de lui laisser une nourriture permanente dans le bac. Les légumes, protéines et compléments sont utiles, mais ils restent des apports ponctuels à doser selon la consommation réelle.',
    recap: {
      summary:
        'Les feuilles, le bois décomposé et le substrat constituent la base permanente. Les légumes et protéines sont des compléments à distribuer selon la consommation réelle de la colonie.',
      points: [
        'Commencer avec une petite quantité',
        'Retirer les restes avant putréfaction',
        'Maintenir une source de calcium',
        'Adapter la dose aux effectifs',
      ],
    },
    facts: [
      ['Base', 'feuilles + bois', 'en permanence'],
      ['Frais', '24–48 h', 'retirer les restes'],
      ['Protéines', 'petites doses', 'selon consommation'],
    ],
    sections: [
      {
        title: 'Comprendre ce que mange réellement une colonie',
        paragraphs: [
          'Les isopodes détritivores exploitent surtout la matière organique en décomposition : feuilles mortes, bois décomposé, humus et films microbiens. Leur alimentation ne se résume donc pas à ce que vous ajoutez dans une coupelle.',
          'La litière et le bois doivent rester disponibles en permanence. Ils amortissent les périodes où vous ne nourrissez pas, donnent des cachettes et permettent aux jeunes de trouver une alimentation discrète.',
        ],
      },
      {
        title: 'Les compléments : ajouter une petite quantité utile',
        paragraphs: [
          'Les végétaux, aliments secs adaptés et sources protéinées peuvent soutenir une colonie, particulièrement lorsque les effectifs augmentent. Le bon dosage se lit simplement : une portion doit être consommée proprement, sans rester assez longtemps pour fermenter.',
          'Commencez toujours plus petit que ce que vous imaginez nécessaire. Augmentez seulement lorsque vous observez une consommation régulière, puis réduisez si des restes persistent.',
        ],
        bullets: [
          'Végétaux simples et propres : petites portions, restes retirés.',
          'Aliments secs : pratiques pour doser et limiter l’excès d’eau.',
          'Protéines : utiles à dose mesurée, jamais comme base unique.',
          'Calcium : accessible en continu, séparé de la nourriture fraîche.',
        ],
      },
      {
        title: 'Les protéines : un apport à adapter',
        paragraphs: [
          'De nombreuses espèces apprécient des sources protéinées ponctuelles. Elles peuvent accompagner croissance et reproduction lorsque le milieu est déjà équilibré. Mais un apport trop généreux dans une boîte chaude et humide dégrade vite la qualité du substrat.',
          'Gardez une fréquence et une taille d’apport adaptées aux effectifs. Si un aliment reste visible ou déclenche un déséquilibre, retirez-le, laissez le bac revenir à l’équilibre, puis reprenez plus petit.',
        ],
      },
      {
        title: 'La règle des 24 à 48 heures',
        paragraphs: [
          'Les aliments frais ne doivent pas s’installer dans le bac. Vérifiez-les dès le lendemain ; retirez-les s’ils ramollissent, deviennent visqueux, se couvrent d’une moisissure dense ou ne sont plus consommés.',
          'Les restes secs peuvent parfois rester plus longtemps, mais le principe ne change pas : si l’apport ne sert pas à la colonie, il n’a pas à rester. Votre objectif est un habitat stable, pas une nourriture en excès.',
        ],
      },
      {
        title: 'Adapter la ration à ce que vous observez',
        bullets: [
          'Colonie jeune ou arrivée récente : priorité aux feuilles, au bois et à la tranquillité.',
          'Colonie active qui termine les compléments : augmenter par petites étapes seulement.',
          'Substrat humide, odeur ou moisissures : réduire les apports et vérifier l’aération.',
          'Présence de jeunes : conserver beaucoup de litière fine et de nourriture de fond.',
        ],
        warning:
          'La faim apparente n’est pas une raison pour nourrir massivement. Des animaux regroupés peuvent simplement exploiter une ressource ou une cachette. L’état général du milieu reste le meilleur indicateur.',
      },
      {
        title: 'Les erreurs qui reviennent le plus souvent',
        bullets: [
          'Faire des légumes le cœur de l’alimentation au lieu de maintenir feuilles et bois.',
          'Ajouter une portion avant que la précédente ne soit consommée.',
          'Oublier le calcium ou le proposer sous une forme incertaine.',
          'Utiliser des aliments traités, salés, assaisonnés ou issus d’une cuisine préparée.',
          'Essayer de compenser un bac pauvre avec toujours plus de compléments.',
        ],
      },
    ],
    sources: [
      {
        label: 'Ashopods — alimentation de fond et compléments',
        href: 'https://www.ashopods.com/isopodcare',
      },
      {
        label: 'Scuttle & Squeak — alimentation, calcium et retrait des restes',
        href: 'https://scuttleandsqueak.com/care-guides/isopods/porcellio-hoffmannseggi',
      },
    ],
    visuals: [
      {
        src: 'https://images.sumup.com/img_4NND77G4TW92CR3Y00MN76FDFS',
        alt: 'Complément Protein EXE',
        caption: 'Les protéines restent un complément mesuré, jamais la base.',
      },
      {
        src: 'https://images.sumup.com/img_39DCXRXVWA8F4S2B60MTWR2CTJ',
        alt: 'Colonie de Cubaris murina',
        caption: 'La quantité distribuée doit suivre la taille réelle de la colonie.',
      },
    ],
  },
  {
    slug: 'proteger-elevages-canicule',
    category: 'Techniques d’élevage',
    title: 'Protéger ses élevages de la chaleur',
    summary:
      'Une préparation concrète pour prévenir la surchauffe, garder son calme et agir sans provoquer de choc thermique.',
    readingTime: '11 min',
    level: 'Débutant',
    intro:
      'Lors d’une canicule, le danger n’est pas seulement la température affichée : une petite boîte près d’une fenêtre, d’un mur chaud ou sous les combles peut monter très vite. Le réflexe utile est d’anticiper, de stabiliser l’environnement et d’éviter les solutions brutales.',
    recap: {
      summary:
        'La priorité est de refroidir la pièce et d’éviter l’exposition directe. Toute baisse de température doit être progressive afin de ne pas remplacer la surchauffe par un choc thermique.',
      points: [
        'Éloigner les bacs du soleil',
        'Couper les chauffages inutiles',
        'Refroidir sans contact avec le gel',
        'Surveiller température et comportement',
      ],
    },
    facts: [
      ['Surveillance', 'matin + soir', 'minimum'],
      ['Refroidissement', 'progressif', 'sans contact gelé'],
      ['Priorité', 'pièce fraîche', 'avant le bac'],
    ],
    sections: [
      {
        title: 'Repérer les situations à risque avant qu’il fasse chaud',
        paragraphs: [
          'Une étagère ensoleillée, une pièce sous toiture, un meuble contre une baie vitrée ou la proximité d’appareils qui chauffent sont souvent plus problématiques que la température moyenne annoncée. Mesurez là où sont les bacs, pas seulement au centre de la pièce.',
          'Connaître à l’avance la pièce la plus fraîche vous évite une décision précipitée. Préparez un emplacement stable, à l’ombre, hors courant d’air violent, avec assez de place pour espacer les boîtes et contrôler régulièrement les températures.',
        ],
      },
      {
        title: 'Le plan de prévention le plus efficace',
        bullets: [
          'Fermer stores ou volets avant que le soleil n’entre, puis aérer quand l’extérieur devient plus frais.',
          'Déplacer les élevages loin des vitres, radiateurs, éclairages et appareils chauds.',
          'Couper les chauffages non indispensables et vérifier les thermostats.',
          'Utiliser des thermomètres fiables à hauteur des bacs, matin, après-midi et soir.',
          'Réduire les manipulations et les transports pendant les heures chaudes.',
        ],
      },
      {
        title: 'Refroidir progressivement sans détremper le bac',
        paragraphs: [
          'Commencez toujours par rafraîchir la pièce : occultation, circulation d’air dans la pièce sans souffler directement dans les bacs, et déplacement vers une zone plus fraîche. Une bouteille froide placée à proximité, séparée du bac, peut aider localement ; elle doit rester une mesure douce et surveillée.',
          'Pour les élevages qui exigent un refuge humide, gardez cette zone utilisable avec de petites corrections ciblées. N’inondez pas tout le substrat dans une boîte chaude : l’eau stagnante et la chaleur forment une mauvaise combinaison.',
        ],
      },
      {
        title: 'Ce qu’il ne faut pas faire dans l’urgence',
        bullets: [
          'Placer directement un pain de glace ou une bouteille gelée contre une boîte.',
          'Pulvériser abondamment tous les bacs dans une pièce chaude et peu ventilée.',
          'Alterner brutalement entre pièce surchauffée et environnement très froid.',
          'Laisser une boîte de transport au soleil, même brièvement.',
        ],
        warning:
          'La réponse la plus sûre est rarement la plus spectaculaire : baisse progressive, stabilité, eau ciblée si nécessaire et surveillance. Les seuils exacts dépendent de l’espèce et de la durée d’exposition.',
      },
      {
        title: 'Après l’épisode : vérifier et reprendre une routine normale',
        paragraphs: [
          'Quand la température redescend, ne compensez pas immédiatement par une série de gros arrosages ou de nourrissages. Observez les animaux, contrôlez la zone humide, retirez les éventuels aliments abîmés et laissez le bac retrouver une température régulière.',
          'Notez ce qui a fonctionné : la pièce la plus fraîche, l’heure où la chaleur devient critique, les bacs qui se réchauffent le plus vite. Ces informations vous permettront de préparer l’épisode suivant avec bien moins de stress.',
        ],
      },
    ],
    sources: [
      {
        label:
          'Herpeton Academy — principes de stabilité thermique pour les invertébrés nourriciers',
        href: 'https://academy.herpeton.net/en/caresheets/feeders/folsomia-candida/',
      },
      {
        label: 'TC Insects — éviter soleil direct et surchauffe dans les cultures',
        href: 'https://tcinsects.com/product/lepidocyrtus-sp-micro-gold-springtails/',
      },
    ],
    visuals: [
      {
        src: 'https://images.sumup.com/img_739KRRWANC8D1A7MATD3WBAJ79',
        alt: 'Isopode tropical en élevage',
        caption: 'La durée d’exposition compte autant que la température maximale.',
      },
      {
        src: 'https://images.sumup.com/img_4BS96M21D08CVV1HR4DWDV02S3',
        alt: 'Substrat humide aéré',
        caption: 'Un substrat frais aide, mais ne compense pas une pièce surchauffée.',
      },
    ],
  },
  {
    slug: 'terrarium-bioactif',
    category: 'Milieux & bioactivité',
    title: 'Créer un terrarium bioactif équilibré',
    summary:
      'Construire un milieu planté, fonctionnel et suivi : couches, microfaune, maturation et entretien réel.',
    readingTime: '16 min',
    level: 'Intermédiaire',
    intro:
      'Un terrarium bioactif n’est pas un système sans entretien. C’est un milieu que l’on conçoit pour soutenir le vivant : plantes adaptées, substrat structuré, cachettes, microfaune et observation régulière. Bien préparé, il réduit certaines tâches sans supprimer votre responsabilité d’éleveur.',
    recap: {
      summary:
        'Un terrarium bioactif associe plantes, microfaune et micro-organismes, mais il n’est jamais autonome. Il demande une période de maturation et des apports organiques réguliers.',
      points: [
        'Introduire une microfaune adaptée',
        'Laisser le milieu maturer',
        'Prévoir des cachettes et zones sombres',
        'Continuer les apports de litière',
      ],
    },
    facts: [
      ['Maturation', '3–6 semaines', 'repère courant'],
      ['Éclairage', '10–12 h', 'selon plantes'],
      ['Litière', 'continue', 'à renouveler'],
    ],
    sections: [
      {
        title: 'Commencer par les besoins de l’animal, pas par la décoration',
        paragraphs: [
          'Avant de choisir plantes et détritivores, listez les besoins de l’espèce hébergée : humidité, aération, température, profondeur de sol, zones de repos, risque d’ingestion et comportement fouisseur. Le terrarium doit servir l’animal ; la dimension bioactive vient ensuite renforcer un habitat déjà cohérent.',
          'Un montage tropical très humide, un terrarium tempéré et un espace plus sec ne se construisent pas de la même façon. Les espèces de la microfaune doivent tolérer les mêmes conditions que l’animal et les plantes.',
        ],
      },
      {
        title: 'Les couches : une structure adaptée à l’eau et aux racines',
        paragraphs: [
          'Dans un terrarium planté et très arrosé, une couche de drainage peut empêcher que les racines restent dans une eau stagnante. Elle est séparée du substrat par une barrière appropriée, puis recouverte d’un mélange respirant et riche. Elle n’autorise pas pour autant les excès d’arrosage.',
          'La couche principale doit permettre aux plantes de s’enraciner, à la microfaune de circuler et aux espèces fouisseuses de s’enfouir. Ajoutez généreusement feuilles mortes, bois et liège : ils servent de cachettes, de support biologique et de nourriture.',
        ],
      },
      {
        title: 'La microfaune : chacun son rôle, aucun miracle',
        paragraphs: [
          'Les collemboles consomment surtout des ressources très fines et contribuent à limiter certains développements fongiques dans les zones humides. Les isopodes fragmentent les feuilles, le bois et les restes organiques plus grossiers. Les bactéries, champignons et autres organismes terminent la décomposition.',
          'Cette équipe n’efface pas instantanément les déjections, la nourriture oubliée ou une erreur d’humidité. Elle fonctionne quand les apports restent raisonnables, que la litière est renouvelée et que les paramètres sont adaptés.',
        ],
        bullets: [
          'Ensemencer une microfaune adaptée à l’humidité visée.',
          'Prévoir des refuges humides pour les collemboles et isopodes.',
          'Garder de la litière disponible : c’est une ressource, pas un déchet.',
          'Ne jamais utiliser pesticides, nettoyants chimiques ou végétaux récemment traités.',
        ],
      },
      {
        title: 'Laisser le terrarium maturer',
        paragraphs: [
          'Après la plantation, le substrat, les plantes et la microfaune ont besoin de temps pour s’installer. Des changements de couleur ou de petites moisissures localisées peuvent apparaître dans les premières semaines : c’est une période d’observation, pas une permission d’ignorer le terrarium.',
          'Introduisez l’animal lorsque les paramètres sont stables, que les plantes tiennent, que l’eau est maîtrisée et que la microfaune a trouvé ses refuges. Une mise en route trop rapide expose l’animal à un milieu instable.',
        ],
      },
      {
        title: 'Lumière, plantes et cachettes',
        paragraphs: [
          'La lumière est choisie pour les plantes et réglée selon leur besoin, sans retirer à l’animal ses zones de repli. Les plantes doivent être compatibles avec l’humidité, le sol et le comportement de l’occupant.',
          'Installez plusieurs cachettes et des zones visuellement calmes. Un terrarium vivant peut être spectaculaire tout en offrant de vrais refuges. L’observation de l’animal, et non l’apparence du décor seul, doit guider les ajustements.',
        ],
      },
      {
        title: 'L’entretien reste une responsabilité',
        bullets: [
          'Retirer les aliments non consommés et les matières en putréfaction.',
          'Tailler ou remplacer les plantes lorsqu’elles modifient trop le milieu.',
          'Ajouter feuilles, bois et parfois microfaune lorsque les ressources diminuent.',
          'Contrôler humidité, ventilation, drainage et comportement de l’animal.',
          'Garder une culture de secours de collemboles.',
        ],
        warning:
          'Bioactif ne signifie pas autonome. Un terrarium reste un habitat captif : l’éleveur doit contrôler les paramètres et le bien-être de l’animal dans la durée.',
      },
    ],
    sources: [
      {
        label: 'Bioactive Bugs UK — construction et entretien d’un vivarium bioactif',
        href: 'https://bioactivebugs.co.uk/care-guides/bioactive-vivarium-guide/',
      },
      {
        label: 'HVR Reptile & Rescue — rôle de la microfaune',
        href: 'https://www.hvreptilerescue.org/resources/bioactive-guide/the-clean-up-crew',
      },
    ],
    visuals: [
      {
        src: 'https://images.sumup.com/img_7S1R4HACYG9QB9T93TECW2HYDY',
        alt: 'Collemboles Lilac',
        caption: 'Les collemboles occupent une fonction différente de celle des isopodes.',
      },
      {
        src: 'https://images.sumup.com/img_39DCXRXVWA8F4S2B60MTWR2CTJ',
        alt: 'Isopode détritivore',
        caption: 'La diversité des décomposeurs rend le système plus résilient.',
      },
    ],
  },
  {
    slug: 'debuter-myriapodes',
    category: 'Bien débuter',
    title: 'Débuter avec les myriapodes',
    summary:
      'Préparer un habitat profond et nourrissant, choisir une espèce adaptée et respecter les temps invisibles de la mue.',
    readingTime: '14 min',
    level: 'Débutant',
    intro:
      'Les diplopodes ne sont pas des animaux à poser sur un décor : une grande partie de leur vie se déroule dans le substrat. La qualité, la profondeur et la sécurité de ce milieu comptent autant que la surface visible du terrarium.',
    recap: {
      summary:
        'La profondeur et la richesse du substrat sont aussi importantes que la surface du terrarium. Le milieu doit rester humide et aéré, avec suffisamment de matière décomposée pour nourrir l’animal.',
      points: [
        'Vérifier la taille adulte de l’espèce',
        'Offrir feuilles et bois décomposé',
        'Prévoir un substrat réellement profond',
        'Soutenir tout le corps lors des manipulations',
      ],
    },
    facts: [
      ['Substrat', '≥ longueur du corps', 'repère minimal'],
      ['Humidité', 'stable', 'sans saturation'],
      ['Manipulation', 'rare', 'corps soutenu'],
    ],
    sections: [
      {
        title: 'Choisir l’espèce avec lucidité',
        paragraphs: [
          'Avant toute adoption, vérifiez la taille adulte, le pays d’origine, la température, l’humidité, la profondeur de substrat et le comportement fouisseur. Une espèce robuste, reproduite depuis plusieurs générations en captivité et accompagnée d’une fiche claire constitue un premier choix plus responsable.',
          'Les paramètres génériques ne remplacent jamais les besoins de l’espèce. Certaines espèces de milieux plus secs demandent un refuge humide sans substrat constamment détrempé ; de nombreux diplopodes tropicaux utilisent au contraire un sol très riche et humide.',
        ],
      },
      {
        title: 'Le substrat est une part majeure de leur alimentation',
        paragraphs: [
          'Les diplopodes détritivores consomment et explorent un sol riche en feuilles mortes et en bois de feuillus décomposé. Un simple mélange pauvre ou décoratif ne répond pas à ce besoin. Préparez un substrat meuble, varié, sans engrais ni pesticides.',
          'La profondeur doit permettre à l’animal de s’enfouir entièrement et de muer en sécurité. Une règle pratique consiste à offrir au moins une profondeur comparable à sa longueur, souvent davantage selon sa fiche d’espèce. Ne tassez pas ce sol.',
        ],
        bullets: [
          'Feuilles mortes et bois blanc décomposé en continu.',
          'Substrat profond, sans couche dure au fond.',
          'Humidité stable dans le sol, sans saturation.',
          'Cachettes de liège et litière épaisse pour limiter l’exposition.',
        ],
      },
      {
        title: 'Aménager le terrarium sans créer de danger',
        paragraphs: [
          'Les décors lourds ne doivent jamais pouvoir basculer lorsqu’un animal creuse dessous. Posez les éléments structurels de façon stable avant d’ajouter le substrat ou choisissez des cachettes légères. Les chutes et écrasements sont des risques évitables.',
          'Prévoyez une ventilation adaptée au niveau d’humidité, un couvercle sécurisé et une température stable, loin du soleil direct. Air stagnant, chaleur excessive et eau libre favorisent les problèmes plutôt qu’un milieu sain.',
        ],
      },
      {
        title: 'Alimenter et observer sans transformer le sol en poubelle',
        paragraphs: [
          'La base alimentaire reste dans le substrat. Des compléments végétaux adaptés peuvent être proposés en petite quantité, puis retirés s’ils se dégradent. Une source de calcium sûre peut compléter l’installation.',
          'Surveillez le comportement, l’état de la litière, l’humidité profonde et l’absence d’odeur anormale. La présence de microfaune peut être utile dans un milieu cohérent, mais elle ne dispense pas de gérer les paramètres.',
        ],
      },
      {
        title: 'Manipulation, mue et reproduction : laisser le temps au vivant',
        paragraphs: [
          'Manipulez seulement lorsque c’est nécessaire, près d’une surface basse, en soutenant tout le corps. Certains diplopodes émettent des sécrétions défensives : lavez-vous soigneusement les mains après contact et évitez yeux, bouche et peaux fragiles.',
          'Un animal enfoui peut être en mue, au repos ou en train de préparer une ponte. Ne le déterrez jamais pour vérifier. C’est sous terre qu’il trouve le calme, la protection et l’humidité nécessaires à cette phase vulnérable.',
        ],
        warning:
          'La meilleure manipulation est souvent celle que l’on évite. Ne retournez pas le substrat à la recherche d’un animal absent.',
      },
    ],
    sources: [
      {
        label: 'Appalachian Tarantulas — besoins de substrat et de profondeur chez les diplopodes',
        href: 'https://www.appalachiantarantulas.com/care-guides/chicobolus-spinigerus',
      },
      {
        label: 'DubiaRoaches — exemple de maintien d’un diplopode tropical',
        href: 'https://dubiaroaches.com/blogs/invert-care/african-giant-millipede-care-sheet',
      },
    ],
    visuals: [
      {
        src: 'https://images.sumup.com/img_6HP6AF9ZYH9899YW5W53KPA0HP',
        alt: 'Anadenobolus monilicornis',
        caption: 'Choisissez une espèce dont les paramètres sont bien documentés.',
      },
      {
        src: 'https://images.sumup.com/img_64EGQ7W09S9JSVKJ9HZSRGGQQZ',
        alt: 'Substrat premium myriapode',
        caption: 'Pour un diplopode, la profondeur du substrat est un besoin vital.',
      },
    ],
  },
  {
    slug: 'collemboles-culture-entretien',
    category: 'Milieux & bioactivité',
    title: 'Maintenir une culture de collemboles',
    summary:
      'Mettre en place une culture propre, productive et durable pour ensemencer ses terrariums sans risquer toute sa souche.',
    readingTime: '13 min',
    level: 'Débutant',
    intro:
      'Une culture séparée de collemboles est une vraie sécurité : elle permet de renforcer un terrarium, de relancer un élevage et de ne pas dépendre d’une seule population. La recette est simple — humidité adaptée, petites quantités de nourriture, air renouvelé — mais la régularité fait toute la différence.',
    recap: {
      summary:
        'Une culture productive repose sur une humidité adaptée et des apports alimentaires minuscules. Une seconde culture indépendante évite de perdre définitivement une souche en cas de problème.',
      points: [
        'Éviter tout excès de nourriture',
        'Adapter l’humidité à la souche',
        'Conserver une culture de secours',
        'Récolter sans vider la population',
      ],
    },
    facts: [
      ['Nourrissage', '1–2× / semaine', 'très petite dose'],
      ['Sauvegarde', '2 cultures', 'recommandé'],
      ['Récolte', 'partielle', 'préserver la souche'],
    ],
    sections: [
      {
        title: 'Choisir le bon type de culture pour sa souche',
        paragraphs: [
          'Les collemboles ne se maintiennent pas tous de la même manière. Une culture sur charbon ou argile est souvent pratique à surveiller et à récolter ; une culture sur substrat organique peut mieux convenir à certaines souches ou à un ensemencement direct.',
          'Quel que soit le support, privilégiez une boîte propre, transparente, avec couvercle et une aération fine adaptée. Placez-la hors du soleil direct : les petits volumes chauffent et sèchent très rapidement.',
        ],
      },
      {
        title: 'Trouver l’équilibre entre eau et air',
        paragraphs: [
          'Le support doit rester humide, jamais complètement sec, mais il ne doit pas devenir une soupe sans oxygène. Sur charbon ou argile, l’eau libre peut être utilisée selon la méthode et la souche ; sur substrat organique, cherchez plutôt une humidité régulière sans eau qui stagne.',
          'Une légère ventilation aide à éviter les odeurs et l’excès de moisissures. Trop d’ouverture dessèche le milieu ; pas assez d’échange peut le rendre stagnant. Commencez modérément et adaptez selon la condensation, l’odeur et l’activité observée.',
        ],
        bullets: [
          'Support humide au toucher, sans dessèchement complet.',
          'Pas de soleil direct, pas de tapis chauffant non régulé.',
          'Aérations très fines ou ouvertures limitées selon le format du bac.',
          'Température stable, cohérente avec la souche maintenue.',
        ],
      },
      {
        title: 'Nourrir peu : la règle qui sauve le plus de cultures',
        paragraphs: [
          'Les collemboles consomment de très petites quantités. Une fine pincée de nourriture adaptée suffit souvent ; attendez qu’elle soit presque entièrement consommée avant d’en remettre. L’excès est une cause fréquente de moisissures massives, d’acariens et d’odeurs.',
          'Si une zone moisit fortement ou sent mauvais, retirez les excès, réduisez le nourrissage et vérifiez que le support n’est pas trop humide. Ne cherchez pas à booster une culture déjà déséquilibrée avec plus de nourriture.',
        ],
      },
      {
        title: 'Récolter sans vider sa réserve',
        paragraphs: [
          'Une récolte réussie laisse toujours assez d’individus et de support pour que la culture reparte. Selon le système, on peut transférer une petite portion de support ou utiliser une méthode de flottaison pour faire migrer les collemboles vers le terrarium.',
          'Après une grosse récolte, laissez la culture récupérer avant de recommencer. Une souche régulière mais modeste est plus utile qu’un bac très productif vidé sans réserve.',
        ],
      },
      {
        title: 'Créer une vraie culture de secours',
        paragraphs: [
          'Dès que la première culture est stable, démarrez-en une seconde dans un contenant indépendant. Ne les nourrissez pas le même jour et évitez de passer le même outil d’un bac à l’autre sans le nettoyer.',
          'Étiquetez vos cultures : souche, date de démarrage, dernier nourrissage et observations. Cette habitude permet de comprendre pourquoi une boîte accélère, ralentit ou commence à se dégrader.',
        ],
      },
      {
        title: 'Diagnostiquer les problèmes sans paniquer',
        bullets: [
          'Culture sèche et peu active : réhumidifier progressivement, loin d’une source de chaleur.',
          'Odeur aigre ou support visqueux : retirer les excès, réduire la nourriture et améliorer légèrement l’échange d’air.',
          'Moisissure envahissante : cesser de nourrir, isoler la culture et repartir d’une sauvegarde si nécessaire.',
          'Acariens ou contamination persistante : protéger la culture saine et redémarrer la culture compromise avec du matériel propre.',
        ],
        warning:
          'Ne relâchez jamais une culture dans la nature. Une souche d’élevage doit rester dans un environnement contrôlé ; en cas d’arrêt, choisissez une disposition responsable adaptée à votre contexte local.',
      },
    ],
    sources: [
      {
        label: 'Herpeton Academy — entretien des cultures de collemboles',
        href: 'https://academy.herpeton.net/en/caresheets/feeders/folsomia-candida/',
      },
      {
        label: 'Bioactive Bugs UK — humidité, nourrissage et reproduction',
        href: 'https://bioactivebugs.co.uk/care-guides/springtail-care-guide/',
      },
    ],
    visuals: [
      {
        src: 'https://images.sumup.com/img_525B4NPW2D98FBQ2E2WXFXDFVH',
        alt: 'Ceratophysella isabellae Albinos',
        caption: 'Toutes les espèces de collemboles ne se cultivent pas de la même manière.',
      },
      {
        src: 'https://images.sumup.com/img_7MMHCNNNTF8WPTJREF7KVE61KR',
        alt: 'Ceratophysella isabellae Sunflowers',
        caption: 'Conserver plusieurs cultures protège une souche précieuse.',
      },
    ],
  },
];

export async function seedGuides(): Promise<void> {
  console.log('🌱 Seeding des guides...');

  for (const [index, guide] of GUIDES.entries()) {
    const base = {
      title: guide.title,
      category: guide.category,
      summary: guide.summary,
      readingTime: guide.readingTime,
      level: guide.level,
      intro: guide.intro,
      recapSummary: guide.recap.summary,
      recapPoints: guide.recap.points,
      position: index,
      isPublished: true,
    };

    const children = {
      sections: {
        create: guide.sections.map((section, position) => ({
          position,
          title: section.title,
          paragraphs: section.paragraphs ?? [],
          bullets: section.bullets ?? [],
          warning: section.warning ?? null,
        })),
      },
      sources: {
        create: guide.sources.map((source, position) => ({ position, ...source })),
      },
      facts: {
        create: guide.facts.map(([label, value, note], position) => ({
          position,
          label,
          value,
          note,
        })),
      },
      visuals: {
        create: guide.visuals.map((visual, position) => ({ position, ...visual })),
      },
    };

    // Les blocs enfants sont régénérés à chaque passage pour rester alignés sur la source.
    await prisma.$transaction(async (tx) => {
      const existing = await tx.guide.findUnique({ where: { slug: guide.slug }, select: { id: true } });

      if (existing) {
        await tx.guideSection.deleteMany({ where: { guideId: existing.id } });
        await tx.guideSource.deleteMany({ where: { guideId: existing.id } });
        await tx.guideFact.deleteMany({ where: { guideId: existing.id } });
        await tx.guideVisual.deleteMany({ where: { guideId: existing.id } });
      }

      await tx.guide.upsert({
        where: { slug: guide.slug },
        update: { ...base, ...children },
        create: { slug: guide.slug, ...base, ...children },
      });
    });

    console.log(`   ✅ ${guide.slug}`);
  }

  console.log(`🎉 ${GUIDES.length} guides seedés`);
}

const isDirectRun = process.argv[1]?.includes('guides.seed');

if (isDirectRun) {
  seedGuides()
    .catch((e) => {
      console.error('❌ Erreur lors du seeding des guides:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
