#!/usr/bin/env node

const { join, dirname, relative } = require("path");
const {
    readdirSync,
    lstatSync,
    copyFileSync,
    mkdirSync,
    existsSync,
    readFileSync,
    writeFileSync,
    rmSync,
} = require("fs");
const { execSync } = require("child_process");
const semver = require("semver");
const AdmZip = require("adm-zip");
const esbuild = require("esbuild");

const SRC = join(__dirname, "src");
const DIST = join(__dirname, "dist");

// Bundled by esbuild rather than copied.
const BUNDLE_ENTRIES = [
    "scripts/appEntrypoint.js",
    "scripts/optionsEntrypoint.js",
    "scripts/bgprocess.js",
];
// Runs as a Web Worker, so it gets its own classic-script bundle.
const WORKER_ENTRY = "scripts/options/worker.ts";
const WORKER_OUTPUT = "scripts/options/worker.js";

// Utility functions
const scan = (dir) => {
    const filesList = [];
    readdirSync(dir).forEach((file) => {
        if (file[0] === ".") {
            return;
        }
        const filePath = join(dir, file);

        if (lstatSync(filePath).isDirectory()) {
            filesList.push(...scan(filePath));
            return;
        }
        filesList.push(filePath);
    });
    return filesList;
};

const ensureDirectoryExists = (dirPath) => {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }
};

// Main functions
const bumpVersion = (level = "patch") => {
    console.log(`Bumping version (${level})...`);
    const manifestPath = join(SRC, "manifest.json");
    const packagePath = join(__dirname, "package.json");

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const version = semver.inc(manifest.version, level);

    manifest.version = version;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    // package.json is kept in step with the manifest; the two had drifted apart.
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    pkg.version = version;
    writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

    console.log(`Version bumped to ${version}`);
    return version;
};

const commit = (level = "patch") => {
    console.log("Committing changes...");
    try {
        execSync("git add *", { stdio: "inherit" });
        execSync(`git commit -m "auto version bump: ${level}"`, {
            stdio: "inherit",
        });
        console.log("Changes committed");
        return true;
    } catch (error) {
        console.error("Git commit failed:", error.message);
        return false;
    }
};

const copyFiles = () => {
    console.log("Copying static files from src to dist...");

    // Bundle chunk names carry a content hash, so leftovers from an earlier build
    // would linger forever and be packaged.
    rmSync(DIST, { recursive: true, force: true });
    ensureDirectoryExists(DIST);

    const srcFiles = scan(SRC);
    let copied = 0;

    srcFiles.forEach((srcFile) => {
        const relativePath = relative(SRC, srcFile).replace(/\\/g, "/");

        // Everything under scripts/ is bundled, except the worker which is
        // emitted separately. Templates are inlined into the bundles.
        if (relativePath.startsWith("scripts/")) {
            return;
        }

        const destFile = join(DIST, relativePath);
        ensureDirectoryExists(dirname(destFile));
        copyFileSync(srcFile, destFile);
        copied++;
    });

    console.log(`Static files copied (${copied})`);
};

const bundle = async ({ minify = false } = {}) => {
    console.log(`Bundling with esbuild (minify: ${minify})...`);

    const shared = {
        bundle: true,
        // Baseline is the current Firefox ESR and an equivalent Chrome; both have
        // AbortSignal.any, used by the feed loader.
        target: ["firefox128", "chrome120"],
        minify,
        sourcemap: minify ? false : "linked",
        logLevel: "warning",
        loader: { ".html": "text" },
        // Keep third-party license banners in the shipped output.
        legalComments: "eof",
    };

    // One self-contained file per entry point. Splitting emitted content-hashed
    // chunks, and a page that dynamically imported one after a rebuild had
    // renamed it hung forever: Firefox never settles a failed import().
    await esbuild.build({
        ...shared,
        entryPoints: BUNDLE_ENTRIES.map((e) => join(SRC, e)),
        outdir: join(DIST, "scripts"),
        format: "esm",
        splitting: false,
    });

    // Web Workers cannot be ES modules here, so this one is a classic script.
    await esbuild.build({
        ...shared,
        entryPoints: [join(SRC, WORKER_ENTRY)],
        outfile: join(DIST, WORKER_OUTPUT),
        format: "iife",
        splitting: false,
    });

    console.log("Bundled");
};

const zipPackage = () => {
    console.log("Creating zip package...");
    const root = join(__dirname, "dist");
    const manifestPath = join(root, "manifest.json");
    const filesList = scan(root);
    const version = JSON.parse(readFileSync(manifestPath, "utf8")).version;

    const zipFile = new AdmZip();

    filesList.forEach((file) => {
        // A zip from a previous run lives in dist too; packaging it would nest releases.
        if (file.endsWith(".zip")) {
            return;
        }
        // Get the directory relative to the root, or empty string if it's at the root
        const relativePath = dirname(file) === root ? "" : relative(root, dirname(file));
        zipFile.addLocalFile(file, relativePath);
    });

    const zipPath = join(__dirname, "dist", `SmartRSS_v${version}.zip`);
    zipFile.writeZip(zipPath);
    console.log(`Zip package created: ${zipPath}`);
};

const watch = () => {
    console.log("Watching for changes in src directory...");
    const chokidar = require("chokidar");

    let running = false;
    const rebuild = async () => {
        if (running) {
            return;
        }
        running = true;
        try {
            await prepare();
        } catch (error) {
            console.error("Rebuild failed:", error.message);
        } finally {
            running = false;
        }
    };

    chokidar
        .watch(join(__dirname, "src"), {
            ignored: /(^|[/\\])\../,
            persistent: true,
        })
        .on("change", (path) => {
            console.log(`File ${path} has been changed`);
            rebuild();
        });

    console.log("Watching for changes. Press Ctrl+C to stop.");
};

// Combined tasks
const prepare = async ({ minify = false } = {}) => {
    copyFiles();
    await bundle({ minify });
};

const packageTask = async () => {
    await prepare({ minify: true });
    zipPackage();
};

const release = async (level = "patch") => {
    if (!["major", "minor", "patch"].includes(level)) {
        console.error("Wrong update level, aborting");
        return false;
    }

    bumpVersion(level);
    commit(level);
    await prepare({ minify: true });
    zipPackage();
};

// Command line interface
const printUsage = () => {
    console.log(`
Usage: node build.js [command] [options]

Commands:
  prepare             Copy static assets and bundle sources into dist
  package             Prepare (minified) and create zip package
  release [level]     Bump version, commit, prepare, and create zip package
                      level can be: patch, minor, major (default: patch)
  watch               Watch for changes in src directory
  bump-version [level] Bump version number
                      level can be: patch, minor, major (default: patch)
  
Examples:
  node build.js prepare
  node build.js release minor
  node build.js watch
`);
};

// Main
const args = process.argv.slice(2);
const command = args[0];
const option = args[1];

if (!command) {
    printUsage();
    process.exit(0);
}

const run = async () => {
    switch (command) {
        case "prepare":
            await prepare();
            break;
        case "package":
            await packageTask();
            break;
        case "release":
            await release(option || "patch");
            break;
        case "watch":
            await prepare();
            watch();
            break;
        case "bump-version":
            bumpVersion(option || "patch");
            break;
        default:
            console.error(`Unknown command: ${command}`);
            printUsage();
            process.exit(1);
    }
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
