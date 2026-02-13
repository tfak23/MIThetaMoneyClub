# MI Theta Money Club - Giving Lookup

A web application for tracking and displaying donation information for the MI Theta Chapter of Sigma Phi Epsilon fraternity. This tool helps members view their giving levels, track scholarship fund progress, and recognize top donors.

## Overview

The Money Club Giving Lookup is a modern, responsive web application that integrates with Google Sheets to display real-time donation data. Members can search for their contributions, view giving level badges, and track progress toward scholarship funding goals.

## Features

### 🔍 Member Search
- Search by first name, last name, or roll number
- Fuzzy search powered by Fuse.js
- Instant results with detailed giving information
- Visual badge display for each giving level

### 🏆 Giving Levels
10 distinct giving levels with custom badges:
- **The Chairman's Senate** ($50,000+)
- **The Passion Pact** ($25,000 - $49,999)
- **Founders Club** ($10,000 - $24,999)
- **The 1971 Society** ($2,500 - $9,999)
- **Ducal Crown Club** ($1,000 - $2,499)
- **TIPO's Trust** ($500 - $999)
- **SigEp Sam Club** ($200 - $499)
- **Alpha/Beta Club** ($100 - $199)
- **Red Door Club** ($50 - $99)
- **The Sigma Circle** ($1 - $49)

### 📊 Fund Progress Tracking
- Real-time progress bars for active scholarship funds
- **Balanced Man Scholarship Fund**
- **Leadership Fund**
- Completed scholarship fund history:
  - John Jurewicz II Burning Heart Scholarship ($25,000)
  - Patrick J. Taggart Jr. Passion Scholarship ($62,500)

### 🎓 Scholarship Information
- View past scholarship recipients
- Click on completed funds to see detailed scholarship information
- Purpose statements for each scholarship

### 🌟 Recognition Features
- **Top 10 Donors** leaderboard
- Current year donor indicators (gold color)
- Previous year donor indicators (purple color)
- Deceased brother memorial indicators (cyan color)
- Level-based member listings

## Technology Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS Grid and Flexbox
- **Vanilla JavaScript** - No framework dependencies
- **Fuse.js** (v7.1.0) - Fuzzy search functionality

### Fonts & Icons
- **Google Fonts** - Roboto (300, 400, 500, 700, 900 weights)
- **SVG Icons** - Search icon

### Data Source
- **Google Sheets API** - Real-time data fetching
- **LocalStorage** - Client-side caching with 7-day TTL

## File Structure

```
MIThetaMoneyClub/
│
├── index.html              # Main HTML structure
├── README.md              # This file
│
├── css/
│   └── styles.css         # All styling (1039 lines)
│
├── js/
│   ├── app.js            # Main application logic
│   ├── config.js         # Configuration & API settings
│   ├── giving-levels.js  # Level definitions & formatting
│   ├── search.js         # Search functionality (Fuse.js)
│   └── sheets-api.js     # Google Sheets integration
│
└── assets/
    └── badges/           # Giving level badge images
        ├── chairmans-senate.jpg
        ├── passion-pact.jpg
        ├── founders-club.jpg
        ├── the-1971-society.jpg
        ├── ducal-crown-club.jpg
        ├── tipos-trust.jpg
        ├── sigep-sam-club.jpg
        ├── alpha-beta-club.jpg
        ├── red-door-club.jpg
        ├── sigma-circle.jpg
        ├── balanced-man.jpg
        └── leadership.jpg
```

## Setup Instructions

### 1. Google Sheets API Configuration

1. Create a Google Cloud project and enable the Google Sheets API
2. Generate an API key
3. Open `js/config.js` and replace `YOUR_API_KEY_HERE` with your API key:
   ```javascript
   API_KEY: 'your-actual-api-key-here'
   ```

### 2. Google Sheets Setup

The application expects two Google Sheets:

#### Main Data Sheet
- **Sheet Name**: 'Master'
- **Required Columns**:
  - Column C: Designation (Active/Deceased)
  - Column D: Roll Number
  - Column E: First Name
  - Column F: Last Name
  - Column EV: Total Donations
  - Dynamic columns for current/previous year donor data

#### Scholarship Data Sheet
- **Sheet Name**: 'Merit Scholarships'
- Contains scholarship purpose statements and recipient information

**Important**: Ensure both spreadsheets are shared with "Anyone with the link" set to Viewer permissions.

### 3. Local Development

Simply open `index.html` in a web browser. No build process or server required!

For better development experience, use a local server:
```bash
# Python 3
python -m http.server 8000

# Node.js (requires http-server)
npx http-server
```

## Configuration

### Color Scheme (SigEp Branding)
Defined in `css/styles.css`:
- **Primary Red**: `#e2231a`
- **Purple**: `#592C51`
- **White**: `#ffffff`
- **Light Gray**: `#f5f5f5`

### Cache Settings
In `js/config.js`:
- **Cache TTL**: 7 days
- **Cache Version**: 5 (increment to force refresh)

### Year Donor Columns
The app dynamically calculates column positions based on the year:
- Base year: 2026 (Column CW, #101)
- Each year increments by 6 columns

## Features in Detail

### Smart Search
- Searches across first name, last name, full name, and roll number
- Different weighting for different fields
- Fuzzy matching with 0.4 threshold
- Special handling for numeric (roll number) queries

### Caching Strategy
- Member data cached in localStorage
- 7-day TTL with version control
- Stale cache warning if unable to refresh
- Automatic retry on network errors

### Responsive Design
- Mobile-first approach
- Breakpoints at 600px, 1024px
- Adaptive grid layouts
- Touch-friendly interface

### Visual Indicators
Three types of member status indicators:
1. **Deceased** (cyan) - In loving memory
2. **Current Year Donor** (gold) - Gave this year
3. **Previous Year Donor** (purple) - Gave last year

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Lazy loading of scholarship data
- Client-side caching reduces API calls
- Smooth CSS animations with GPU acceleration
- Efficient DOM updates

## Donation Links

Direct links to SigEp National's donation platform:
- **BMS Fund**: Designation #155554
- **Leadership Fund**: Designation #155555

## Data Privacy

- All member data is read-only from Google Sheets
- No personal data is collected by the application
- No cookies or tracking scripts
- All processing happens client-side

## Maintenance

### Updating Giving Levels
Edit `js/giving-levels.js` to modify level thresholds or add new levels.

### Updating Fund Progress
Fund data is automatically fetched from the Summary sheet (cells J2, J4-5, K4-5).

### Adding Badge Images
Place badge images in `assets/badges/` directory with the exact filename referenced in `giving-levels.js`.

## Support

For questions or issues:
- Contact the MI Theta Chapter
- Email: sigep.mitheta.alumni@gmail.com 

## Credits

**Developed for**: Sigma Phi Epsilon - Michigan Theta Chapter  
**Purpose**: Track and recognize donor contributions to chapter scholarships  
**Last Updated**: February 2026

## License

© SigEp MI Theta Chapter. This application is for alumni and chapter use.

---

*"Building Balanced Men"*
