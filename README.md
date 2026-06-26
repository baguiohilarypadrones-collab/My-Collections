# My Collections

This project is a media tracker application, allowing users to keep track of their movies, series, manhwa, anime, books, cartoons, and dramas. It features a React frontend with TypeScript and Tailwind CSS, and an Express.js backend with TypeScript and MongoDB (Mongoose).

## Features

- Track various media types: movies, series, manhwa, anime, books, cartoons, dramas
- Progress tracking for chapters, episodes, seasons, pages, or watch percentage
- Categorized views (Overall, Movies, Series, etc.)
- Carousel and Grid view modes
- Search functionality
- Add, Edit, and Delete media items
- Link related media items (prequels/sequels)
- Dark mode toggle
- Responsive design

## Project Structure

```
my-collections/
├── public/
├── src/
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   ├── services/
│   │   └── api.ts
│   └── utils/
│       └── cn.ts
├── server/
│   ├── .env
│   ├── config/
│   │   └── db.ts
│   ├── models/
│   │   └── media.ts
│   ├── routes/
│   │   └── media.ts
│   ├── index.ts
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MongoDB (local instance or cloud service like MongoDB Atlas)

### 1. Clone the repository

```bash
git clone <your-github-repo-url>
cd my-collections
```

### 2. Backend Setup

Navigate to the `server` directory and install dependencies:

```bash
cd server
npm install
# or yarn install
```

Create a `.env` file in the `server` directory and add your MongoDB URI and port:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/media-tracker
```

Start the backend server:

```bash
npm run dev
# or yarn dev
```

The server will run on `http://localhost:5000` (or the port specified in your `.env` file).

### 3. Frontend Setup

Open a new terminal, navigate back to the project root, and then install frontend dependencies:

```bash
cd .. # if you are in the server directory
npm install
# or yarn install
```

Create a `.env` file in the project root (my-collections/) and specify the backend API base URL:

```env
VITE_API_BASE=http://localhost:5000/api
```

Start the frontend development server:

```bash
npm run dev
# or yarn dev
```

The frontend application will be available at `http://localhost:5173` (or another port if 5173 is in use).

## Usage

1. **Add Media**: Use the "Add Card" button to add new media items, specifying details like title, category, cover image, description, genres, rating, and progress.
3. **Track Progress**: Update the progress directly from the media cards or through the edit form.
4. **View Modes**: Switch between Carousel and Grid views.
5. **Search**: Use the search bar to filter media items.
6. **Dark Mode**: Toggle between light and dark themes.

## Contributing

Feel free to fork the repository, open issues, or submit pull requests.

## License

This project is open source and available under the [MIT License](LICENSE). (Note: A `LICENSE` file is not provided in the PDF, so this is a placeholder.)

## Acknowledgements

- Built with React, TypeScript, Tailwind CSS, Express, and Mongoose.
- Inspired by personal media tracking needs.
