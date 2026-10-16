# Vérification du 16 octobre 2026

L’application enregistre une séance depuis l’interface vers une route HTTP Next.js, puis vers une RPC transactionnelle Supabase et des tables PostgreSQL normalisées. La réponse serveur détermine l’état de sauvegarde de l’interface.

| Contrôle | Résultat observé | Portée |
| --- | --- | --- |
| TypeScript strict | Réussi, aucune erreur | Code de l’application, scripts et tests |
| ESLint TypeScript / React / accessibilité | Réussi, aucune erreur | Code source |
| Vitest | **51 tests réussis** | Calculs, recommandations, validation, clones, SQL/RLS, sauvegarde et parcours des composants |
| Migration et seed | Exécutés avec succès | PostgreSQL embarqué PGlite, catalogue de 62 exercices et re-seed sans doublon |
| Isolation SQL | Réussie | Deux rôles authentifiés, programmes, enfants, exercices privés, séances, séries et poids ; fonctions admin inaccessibles |
| Transactions | Réussies | Instantanés préservés, sauvegardes obsolètes refusées, erreur tardive annulant l’écriture complète, repos par tour conservé |
| Suppression en cascade | Réussie | Suppression d’un utilisateur de test et disparition des données privées liées |
| Sauvegarde React | Réussie | Confirmation serveur, panne et nouvel essai, sérialisation des modifications, reprise locale, conflit et séparation des comptes |
| Composants privés dans le DOM | 2 tests réussis (inclus dans Vitest) | Création de programme avec exercices/superset et soumission valide ; menu mobile donnant accès aux records, au poids, aux paramètres et à la déconnexion |
| Playwright desktop | **2 tests réussis** | Vérification répétée sur le build de production : connexion sans erreur JavaScript/console, sans inscription ni débordement horizontal ; protection page/API sans session |
| Playwright mobile | **2 tests réussis** | Mêmes contrôles sur le build de production avec un viewport iPhone, moteur Chromium/Edge |
| Playwright privé Supabase réel | **2 tests ignorés** | Requiert `E2E_LIVE=1`, les clés d’un projet de test et le domaine technique du propriétaire |
| Inspection visuelle | Connexion ordinateur et téléphone inspectée | Captures dans `docs/previews/` ; les écrans privés n’ont pas été inspectés avec une vraie session |
| Build Next.js production | Réussi avec Webpack | Compilation, types et génération des routes ; Turbopack a échoué sur un processus CSS Windows |
| Audit npm | Aucune vulnérabilité signalée | Dépendances de production et de développement, audit exécuté en fin de vérification |
| Déploiement Vercel | Non effectué | Projet, secrets et configuration externe non fournis |

La stack Supabase complète n’a pas été lancée localement : Docker n’était pas disponible. PGlite exécute la migration et les politiques dans un moteur PostgreSQL embarqué ; les tables et fonctions minimales du schéma Auth sont préparées par les tests. Ce contrôle ne prouve pas le fonctionnement de Supabase Auth, de son service HTTP ni de PostgREST.

## Parcours encore à vérifier sur le service réel

1. Appliquer la migration et le seed au bon projet ; vérifier les droits Data API et lancer les diagnostics de sécurité Supabase.
2. Désactiver les inscriptions et les flux email dans la configuration hébergée.
3. Créer deux comptes avec le script admin ; vérifier la connexion par identifiant et la persistance après reconnexion.
4. Activer les tests Playwright privés sur un projet de test. Ils couvrent programme, exercices, superset, saisie RPE/RIR/repos, brouillon, rechargement, finalisation, historique, graphique, records, correction d’une ancienne séance, thème et isolation entre comptes.
5. Vérifier changement de mot de passe, réinitialisation propriétaire, suppression réelle du compte et révocation de sessions.
6. Déployer avec les variables de l’environnement Vercel puis contrôler l’origine exacte, HTTPS, les cookies et les tentatives de connexion.

Les tests ignorés ne sont pas comptés comme réussis. Aucune connexion, donnée distante ou publication n’est présentée comme validée sans preuve.
