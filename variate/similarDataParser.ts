export interface SpecField {
    title: string;
    description: string;
    image?: string;
}

export interface SpecBox {
    title: string;
    icon?: string;
    fields: SpecField[];
}

interface ParsedEntry {
    section?: string;
    key: string;
    value: string;
    dataKey?: string;
}

/**
 * Normalizes a string for fuzzy key comparison
 * e.g., "Build Materials (Front/Back)" -> "buildmaterialsfrontback"
 */
export function normalizeKey(str: string): string {
    return (str || "")
        .toLowerCase()
        .replace(/&amp;/g, "&")
        .replace(/[^a-z0-9]/g, "");
}

/**
 * Comprehensive dictionary of aliases mapping canonical normalized keys to common variations
 */
const ALIASES: Record<string, string[]> = {
    brand: ["brand", "manufacturer", "make"],
    model: ["model", "modelname", "device"],
    announced: ["announced", "announcementdate", "launchannounced"],
    releasedate: ["releasedate", "release", "launchdate", "releasestatus"],
    releasestatus: ["releasestatus", "status", "availability"],
    devicetype: ["devicetype", "devicetypeformfamily", "formfamily", "formfactor"],
    modelnumbers: ["modelnumbers", "modelnumber", "models", "v2648"],
    dimensions: ["dimensions", "dimension", "size", "bodydimensions"],
    height: ["height"],
    width: ["width"],
    thickness: ["thickness", "depth"],
    weight: ["weight", "bodyweight"],
    buildmaterials: ["buildmaterials", "build", "bodymaterial", "materials"],
    displaytype: ["displaytype", "displaytechnology", "display", "screentype", "paneltype"],
    displaytechnology: ["displaytechnology", "displaytype", "display", "paneltype"],
    displaysize: ["displaysize", "screensize", "size"],
    displayarea: ["displayarea", "screenarea", "area"],
    screenresolution: ["screenresolution", "resolution", "displayresolution"],
    pixeldensity: ["pixeldensity", "density", "ppi"],
    aspectratio: ["aspectratio", "ratio"],
    screentobodyratio: ["screentobodyratio", "screentobody"],
    refreshrate: ["refreshrate", "displayrefreshrate", "screenrefreshrate"],
    brightness: ["brightness", "peakbrightness", "typicalbrightness", "hbm"],
    peakbrightness: ["peakbrightness", "brightness", "hbm"],
    hdrsupport: ["hdrsupport", "hdrformats", "hdr"],
    hdrformats: ["hdrformats", "hdrsupport", "hdr"],
    displayprotection: ["displayprotection", "protection", "glassprotection"],
    displayfeatures: ["displayfeatures", "screenfeatures"],
    chipset: ["chipset", "processor", "soc", "platform"],
    processor: ["processor", "chipset", "soc", "cpu"],
    cpu: ["cpu", "processor"],
    gpu: ["gpu", "graphics"],
    ram: ["ram", "memory", "systemmemory", "physicalram"],
    internalstorage: ["internalstorage", "storage", "rom", "storagecapacity", "memoryconfigurations", "storageoptions"],
    storage: ["storage", "internalstorage", "rom", "storagecapacity", "storageoptions"],
    storagetechnology: ["storagetechnology", "storagetype", "ufstype"],
    cardslot: ["cardslot", "expandablestorage", "memorycardslot", "microsd"],
    rearcamera: ["rearcamera", "maincamera", "backcamera", "primarycamera", "widecamera"],
    frontcamera: ["frontcamera", "selfiecamera", "secondarycamera"],
    rearcamerafeatures: ["rearcamerafeatures", "camerafeatures", "features"],
    rearcameravideo: ["rearcameravideo", "videorecording", "video"],
    frontcamerafeatures: ["frontcamerafeatures"],
    frontcameravideo: ["frontcameravideo"],
    batterycapacity: ["batterycapacity", "battery", "capacity"],
    battery: ["battery", "batterycapacity", "capacity"],
    batterytechnology: ["batterytechnology", "batterytype"],
    fastcharging: ["fastcharging", "charging", "chargingspeed", "wiredcharging"],
    charging: ["charging", "fastcharging", "chargingspeed", "wiredcharging"],
    reversecharging: ["reversecharging", "reverseshare"],
    operatingsystem: ["operatingsystem", "os", "platform", "software"],
    userinterface: ["userinterface", "ui", "customui", "skin"],
    softwaresupport: ["softwaresupport", "updatepolicy", "updates"],
    sim: ["sim", "simcard", "simslots"],
    network: ["network", "technology", "networkspeed"],
    nfc: ["nfc"],
    bluetooth: ["bluetooth"],
    wifi: ["wifi", "wireless", "wlan"],
    usb: ["usb", "usbtype", "chargingport"],
    infrared: ["infrared", "irblaster", "ir"],
    waterresistance: ["waterresistance", "waterresistant", "iprating", "durability"],
    sensors: ["sensors", "sensor", "biometrics"],
    loudspeakers: ["loudspeakers", "loudspeaker", "speaker", "sound", "audio"],
    headphonejack: ["headphonejack", "35mmheadphonejack", "35mmjack", "audiojack"],
    availablecolors: ["availablecolors", "colors", "colours", "coloroptions", "indiacolouroptions"],
    colors: ["colors", "colours", "availablecolors", "coloroptions"]
};

/**
 * Extracts key-value pairs from HTML string using DOMParser
 */
function extractFromHtml(html: string): ParsedEntry[] {
    const results: ParsedEntry[] = [];

    // Fallback if window or DOMParser is not defined (e.g., SSR or node scripts)
    if (typeof window === "undefined" || typeof DOMParser === "undefined") {
        const trRegex = /<tr[^>]*?(?:data-spec-key=["']([^"']+)["'])?[^>]*?>([\s\S]*?)<\/tr>/gi;
        let trMatch;
        while ((trMatch = trRegex.exec(html)) !== null) {
            const dataKey = trMatch[1] || "";
            const rowContent = trMatch[2];

            const thMatch = /<(?:th|dt)[^>]*>([\s\S]*?)<\/(?:th|dt)>/i.exec(rowContent);
            const tdMatch = /<(?:td|dd)[^>]*>([\s\S]*?)<\/(?:td|dd)>/i.exec(rowContent);

            if (thMatch && tdMatch) {
                const key = thMatch[1].replace(/<[^>]+>/g, "").trim();
                const value = tdMatch[1].replace(/<[^>]+>/g, "").trim();
                if (key && value) {
                    results.push({ key, value, dataKey });
                }
            }
        }
        return results;
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // 1. Process sections / cards if available
        const sections = doc.querySelectorAll("section, .ndovu-pdp-card, .specs-group, .spec-group, table");

        if (sections.length > 0) {
            sections.forEach((sec) => {
                let sectionName = "";
                const header = sec.querySelector("header, h2, h3, h4, caption, .specs-heading, .title");
                if (header) {
                    sectionName = header.textContent?.trim() || "";
                }

                const rows = sec.querySelectorAll("tr, .spec-row, li, .data-row");
                rows.forEach((row) => {
                    const th = row.querySelector("th, .label, .spec-name, .ttl, dt");
                    const td = row.querySelector("td, .value, .spec-value, .nfo, dd, .ndovu-pdp-value");

                    if (th && td) {
                        const valSpan = td.querySelector(".ndovu-pdp-value, .nfo, .value");
                        const value = (valSpan?.textContent || td.textContent || "").trim();
                        const key = th.textContent?.trim() || "";
                        const dataKey = row.getAttribute("data-spec-key") || (row as HTMLElement).dataset?.specKey || "";

                        if (key && value) {
                            results.push({ section: sectionName, key, value, dataKey });
                        }
                    }
                });
            });
        }

        // 2. Direct fallback for any <tr> with <th> and <td> across whole document if sections were empty
        if (results.length === 0) {
            const allRows = doc.querySelectorAll("tr");
            allRows.forEach((row) => {
                const th = row.querySelector("th, .label, .ttl, dt");
                const td = row.querySelector("td, .nfo, .value, dd");
                if (th && td) {
                    const valSpan = td.querySelector(".ndovu-pdp-value, .nfo, .value");
                    const value = (valSpan?.textContent || td.textContent || "").trim();
                    const key = th.textContent?.trim() || "";
                    const dataKey = row.getAttribute("data-spec-key") || "";
                    if (key && value) {
                        results.push({ key, value, dataKey });
                    }
                } else {
                    // Try pair of <td> elements
                    const tds = row.querySelectorAll("td");
                    if (tds.length >= 2) {
                        const key = tds[0].textContent?.trim() || "";
                        const value = tds[1].textContent?.trim() || "";
                        if (key && value) {
                            results.push({ key, value });
                        }
                    }
                }
            });
        }
    } catch {
        // Fallback to regex if DOM parsing had an issue
    }

    return results;
}

/**
 * Extracts key-value pairs from plain text or JSON
 */
function extractFromPlainText(text: string): ParsedEntry[] {
    const results: ParsedEntry[] = [];
    const trimmed = text.trim();

    // Check JSON
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
            const parsed = JSON.parse(trimmed);
            const walk = (obj: any, section = "") => {
                if (!obj || typeof obj !== "object") return;
                for (const [k, v] of Object.entries(obj)) {
                    if (typeof v === "object" && v !== null) {
                        walk(v, k);
                    } else if (v != null) {
                        results.push({ section, key: k, value: String(v).trim() });
                    }
                }
            };
            walk(parsed);
            if (results.length > 0) return results;
        } catch {}
    }

    // Line-by-line key: value or key\tvalue
    const lines = text.split(/\r?\n/);
    let currentSection = "";

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Check if section header like [General] or # Display or General:
        const secMatch = line.match(/^\[(.*)\]$/) || line.match(/^#+\s*(.*)$/);
        if (secMatch) {
            currentSection = secMatch[1].trim();
            continue;
        }

        // Delimiter split
        const colonIdx = line.indexOf(":");
        const tabIdx = line.indexOf("\t");

        if (colonIdx > 0 && (tabIdx === -1 || colonIdx < tabIdx)) {
            const key = line.slice(0, colonIdx).trim();
            const value = line.slice(colonIdx + 1).trim();
            if (key && value) {
                results.push({ section: currentSection, key, value });
            }
        } else if (tabIdx > 0) {
            const key = line.slice(0, tabIdx).trim();
            const value = line.slice(tabIdx + 1).trim();
            if (key && value) {
                results.push({ section: currentSection, key, value });
            }
        }
    }

    return results;
}

/**
 * Parse any raw input (HTML, tables, text, JSON) into key-value entries
 */
export function parseRawInput(raw: string): ParsedEntry[] {
    if (!raw || !raw.trim()) return [];

    const isHtml = /<[a-z][\s\S]*>/i.test(raw);
    if (isHtml) {
        const htmlEntries = extractFromHtml(raw);
        if (htmlEntries.length > 0) return htmlEntries;
    }

    return extractFromPlainText(raw);
}

/**
 * Calculates a match score between a target field title and a candidate entry
 * Returns 0 if no match, up to 120 for exact section + exact key match
 */
function calculateMatchScore(
    fieldTitle: string,
    boxTitle: string,
    candidateKey: string,
    candidateSection?: string,
    candidateDataKey?: string
): number {
    const normField = normalizeKey(fieldTitle);
    const normCandidate = normalizeKey(candidateKey);
    const normDataKey = candidateDataKey ? normalizeKey(candidateDataKey) : "";
    const normBox = normalizeKey(boxTitle);
    const normCandidateSection = candidateSection ? normalizeKey(candidateSection) : "";

    let score = 0;

    // Exact key match
    if (normField === normCandidate || (normDataKey && normField === normDataKey)) {
        score = 100;
    } else {
        // Alias match
        const fieldAliases = ALIASES[normField] || [];
        if (fieldAliases.includes(normCandidate) || (normDataKey && fieldAliases.includes(normDataKey))) {
            score = 90;
        } else {
            // Reverse alias match
            for (const [canonical, aliasList] of Object.entries(ALIASES)) {
                if (aliasList.includes(normCandidate) || (normDataKey && aliasList.includes(normDataKey))) {
                    if (canonical === normField || aliasList.includes(normField)) {
                        score = 85;
                        break;
                    }
                }
            }
        }
    }

    // If still 0, check prefix or word match (only if both are > 4 characters)
    if (score === 0 && normField.length >= 4 && normCandidate.length >= 4) {
        if (normField === normCandidate + "s" || normCandidate === normField + "s") {
            // Plural match e.g. color vs colors, loudspeaker vs loudspeakers
            score = 80;
        } else if (normCandidate.startsWith(normField) || normField.startsWith(normCandidate)) {
            // Prefix match e.g. "Screen resolution" vs "Screen resolution (pixels)"
            score = 65;
        }
    }

    // Section context bonus
    if (score > 0 && normCandidateSection && normBox) {
        if (normCandidateSection.includes(normBox) || normBox.includes(normCandidateSection)) {
            score += 20;
        }
    }

    return score;
}

export interface MatchResult {
    matchedBoxes: SpecBox[];
    totalMatched: number;
    totalFields: number;
    unmatchedFields: string[];
}

/**
 * Matches extracted similar data into target specification boxes
 * - Matching fields are updated with extracted values
 * - Non-matching fields remain blank or keep existing values
 */
export function matchSimilarData(rawInput: string, targetBoxes: SpecBox[]): MatchResult {
    const entries = parseRawInput(rawInput);
    let totalMatched = 0;
    let totalFields = 0;
    const unmatchedFields: string[] = [];

    if (entries.length === 0 || targetBoxes.length === 0) {
        return {
            matchedBoxes: targetBoxes,
            totalMatched: 0,
            totalFields: targetBoxes.reduce((acc, b) => acc + b.fields.length, 0),
            unmatchedFields: [],
        };
    }

    // Match each box and field by finding the highest scored entry
    const matchedBoxes: SpecBox[] = targetBoxes.map((box) => {
        const updatedFields = box.fields.map((field) => {
            totalFields++;

            let bestScore = 0;
            let bestValue = "";

            for (const entry of entries) {
                const score = calculateMatchScore(
                    field.title,
                    box.title,
                    entry.key,
                    entry.section,
                    entry.dataKey
                );

                if (score > bestScore) {
                    bestScore = score;
                    bestValue = entry.value;
                }
            }

            if (bestScore >= 60 && bestValue) {
                totalMatched++;
                return {
                    ...field,
                    description: bestValue,
                };
            } else {
                unmatchedFields.push(`${box.title} -> ${field.title}`);
                return {
                    ...field,
                    description: "",
                };
            }
        });

        return {
            ...box,
            fields: updatedFields,
        };
    });

    return {
        matchedBoxes,
        totalMatched,
        totalFields,
        unmatchedFields,
    };
}
