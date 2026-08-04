# Project Re:Place

## Target
This is a personal application temporarily scoped at personal memory management in the following aspects:
- Place recommendation
- Idealization recommendation
- Interactive map display
- Blog like edit with basic rich text support
- AI extracted information display
- History display
- Admin management for AI options

## Components
### User Management
The project can phase begin with one user, but as the service is going to be front-end back-end seperated architecture, it is recommended that session-cookie mechanism and JWT token is provided.

### Admin Management
This application will require AI related tasks. A global control of status will be needed to pass to the APIs to decide to use naive algorithm or LLM decision.

### Home Page
A grid-based application will be provided. Left-upper part should be "today's recommendation for the city" and basic digests. The detail will be given later. The left down part is the idealization for today's topics.
The whole right side should be a fancy interactive map, temporarily will be China map (with Chinese governmental approval like in the controversial areas, like including Taiwan and south Tibet, and other areas.).
The interactive map should be able to be viewed in the city level. No need to display the streets or buildings, although it can be a plus.
By clicking the map object, the user can see the digest of how many articles are about this place and having some avatars. And the user can enter cities for the same thing.

### Edit Page
A general blog like edit page will be provided when the user wants to add an article. At most 3 pictures and 600 (Chinese) characters should be limited. The user can select whether to use AI for fine-tuning the texts.
After submission, the article will be passed to back end for processing.

### History Page
The user can see a inbox-like display of articles, with the choice of sorting by article time, create time, and maybe others.