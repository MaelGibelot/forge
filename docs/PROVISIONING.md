# Ressources créées le 16 octobre 2026

- Supabase : `forge-training`, organisation `MaelGibelot's Org`, région Paris (`eu-west-3`). Projet : `egzytutkpnkdyafgdsrv`.
- La création a été annoncée à 0 USD/mois par le connecteur. Les évolutions de consommation ou de formule sont régies par le compte Supabase.
- Schéma initial appliqué ; 62 exercices et 10 groupes musculaires installés ; RLS activée sur les 16 tables publiques.
- Index de production ajoutés après les diagnostics : aucune clé étrangère non indexée restante. Les index encore inutilisés sont attendus sur une base neuve.
- Vercel : projet `forge-training`, équipe `maelgibelot's projects`, ID `prj_yxhD75Uv1cEODVWCL68MIFqzIkwc`. Framework Next.js, Node.js 24, fonctions à Paris.
- GitHub : dépôt public [MaelGibelot/forge](https://github.com/MaelGibelot/forge), code publié sur `main`. GitHub CLI a été autorisé explicitement par le propriétaire ; aucun fichier d’environnement ni secret n’est publié.

L’application est déployée en production à [forge-maelgibelot.vercel.app](https://forge-maelgibelot.vercel.app). Le premier déploiement `dpl_CqdZxTU2iQTC8kaqJXvP1hUaXMR6`, issu du commit `61c4112`, a atteint l’état `READY`, sans erreur d’alias. Le dépôt est raccordé à Vercel pour les prochains déploiements depuis `main`.

Les six variables de `.env.example` sont configurées pour la production. `SUPABASE_SECRET_KEY` (clé serveur Supabase) et `LOGIN_RATE_SECRET` (48 octets aléatoires) sont enregistrées comme secrets Vercel non révélables. La copie de la clé serveur vers ce projet Vercel a été explicitement autorisée. Aucun secret serveur n’a été écrit dans le dépôt ou dans un fichier d’environnement local. Les environnements Preview et Development ne disposent pas de ces secrets de production.

Supabase Auth : email/mot de passe activé, inscription publique, comptes anonymes et fournisseurs sociaux désactivés ; longueur minimale de mot de passe de 12 caractères. La confirmation email globale reste activée ; le script admin crée directement des comptes confirmés avec `email_confirm: true`, sans envoi d’email. L’URL du site est `https://forge-maelgibelot.vercel.app`.

Aucun compte utilisateur d’application n’a été créé. La création du premier compte avec son identifiant et son mot de passe reste nécessaire avant d’accéder aux écrans privés. La procédure propriétaire est décrite dans le README.

Contrôles sur l’URL publique : 4 tests Playwright réussis sur ordinateur et mobile, page de connexion configurée, redirection des pages privées, API sans session en 401, identifiant inconnu en 401 après accès serveur à Supabase, origine étrangère en 403. Les captures dans `docs/previews/` proviennent de ce déploiement.

Les tables `private.login_identities` et `private.login_attempts` n’ont intentionnellement aucune politique autorisant les clients : elles sont réservées aux fonctions serveur. Les diagnostics de sécurité ne les signalent qu’au niveau informatif ; ne pas ajouter de politique ouverte pour masquer ce signal.

Liens d’administration : [Supabase](https://supabase.com/dashboard/project/egzytutkpnkdyafgdsrv), [Vercel](https://vercel.com/maelgibelots-projects/forge-training).
