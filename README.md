# MOFinder

**MOFinder** is a web application and research database for searching and filtering experimental **metal-organic frameworks (MOFs)** and their reported synthesis conditions by collected data of chemical, structural, stability, and synthesis-related properties.

The application was developed for use by the **Zheng Lab at Washington University in St. Louis** and provides a searchable interface for finding MOFs and comparing the experimental conditions under which they were synthesized.

---

## What MOFinder Provides

### Search

Search for MOFs using:

- MOF names
- Linker names
- Metal names or elements

### Chemical Structure Search

Linkers can be entered as:

- Common chemical names
- SMILES strings
- Drawn molecular structures

### Experimental Filters

Results can be refined using properties such as:

- Water stability
- Air stability
- Thermal stability / TGA
- BET surface area
- Pore diameter
- Maximum synthesis temperature
- Maximum synthesis time

## Technology Stack

MOFinder is built using:

| Technology | Purpose |
|---|---|
| **Next.js** | Web application framework |
| **React** | User interface |
| **TypeScript** | Application development |
| **Tailwind CSS** | Styling |
| **shadcn/ui** | UI components |
| **MySQL** | MOF database |
| **mysql2** | MySQL connectivity |
| **RDKit** | Chemical structure processing |
| **JSME** | Molecular structure drawing |

The project uses the Next.js App Router and TypeScript with strict type checking.

## Repository Structure

```text
MOFinder/
├── .github/
│   └── workflows/           # GitHub Actions workflows
├── app/                     # Routes, application, and styling
├── components/              # Reusable React/UI components
├── constants/               # Application constants
├── lib/                     # Logic and utilities
├── public/
│   └── icons/               # Static assets
├── scripts/                 # Post-build scripts
├── types/                   # Shared project types
├── package.json             # Project dependencies and scripts
├── package-lock.json        # Locked dependency versions
├── tsconfig.json            # TypeScript configuration
└── README.md                # Project documentation
```

## License

MOFinder is distributed under the [`GNU Affero General Public License v3.0 (AGPL-3.0)`](LICENSE).

## Maintainers

MOFinder is maintained for the Zheng Lab at Washington University in St. Louis.

For project-specific development, database, or deployment questions, consult the repository documentation and the appropriate contributors.