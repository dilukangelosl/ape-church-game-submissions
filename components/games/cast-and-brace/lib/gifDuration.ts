/**
 * Sums Graphic Control Extension delay times for one pass through a GIF (ms).
 * Used to align UI with animated GIF length (browsers don't expose a reliable "ended" for `<img>`).
 */

function skipExtensionBlock(v: Uint8Array, i: number): number {
    const label = v[i + 1]!;
    if (label === 0xf9) {
        return i + 8;
    }
    let j = i + 2;
    while (j < v.length) {
        const size = v[j]!;
        j += 1;
        if (size === 0) {
            return j;
        }
        j += size;
    }
    return j;
}

function skipImageBlock(v: Uint8Array, i: number): number {
    if (v[i] !== 0x2c || i + 10 >= v.length) {
        return v.length;
    }
    const packed = v[i + 9]!;
    let j = i + 10;
    if (packed & 0x80) {
        const lctColors = 2 << (packed & 0x07);
        j += 3 * lctColors;
    }
    if (j >= v.length) {
        return v.length;
    }
    j += 1;
    while (j < v.length) {
        const size = v[j]!;
        j += 1;
        if (size === 0) {
            return j;
        }
        j += size;
    }
    return j;
}

/**
 * Returns total duration in ms for one animation cycle (sum of GCE delays), or `null` if not parsed.
 */
export function sumGifGraphicControlDelaysMs(buffer: ArrayBuffer): number | null {
    const v = new Uint8Array(buffer);
    if (v.length < 14) {
        return null;
    }
    if (v[0] !== 0x47 || v[1] !== 0x49 || v[2] !== 0x46) {
        return null;
    }
    const ver = String.fromCharCode(v[3]!, v[4]!, v[5]!);
    if (ver !== "87a" && ver !== "89a") {
        return null;
    }

    const gPacked = v[10]!;
    let i = 13;
    if (gPacked & 0x80) {
        const gctColors = 2 << (gPacked & 0x07);
        i += 3 * gctColors;
    }

    let total = 0;
    let sawGce = false;

    while (i < v.length) {
        const b = v[i]!;
        if (b === 0x3b) {
            break;
        }
        if (b === 0x21) {
            if (i + 7 >= v.length) {
                return null;
            }
            if (v[i + 1] === 0xf9) {
                const delayCs = v[i + 4]! | (v[i + 5]! << 8);
                total += delayCs === 0 ? 100 : delayCs * 10;
                sawGce = true;
                i += 8;
            } else {
                i = skipExtensionBlock(v, i);
            }
        } else if (b === 0x2c) {
            i = skipImageBlock(v, i);
        } else {
            return null;
        }
    }

    if (!sawGce || total <= 0) {
        return null;
    }
    return total;
}
