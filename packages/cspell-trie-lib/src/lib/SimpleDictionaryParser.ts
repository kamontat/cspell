import { operators } from 'gensequence';
import { normalizeWord, normalizeWordForCaseInsensitive } from './util';
import { COMPOUND_FIX, OPTIONAL_COMPOUND_FIX, FORBID_PREFIX, CASE_INSENSITIVE_PREFIX, LINE_COMMENT } from './constants';
import { Trie } from './trie';
import { buildTrieFast } from './TrieBuilder';

export interface ParseDictionaryOptions {
    compoundCharacter: string;
    optionalCompoundCharacter: string;
    forbiddenPrefix: string;
    caseInsensitivePrefix: string;
    commentCharacter: string;
}

const _defaultOptions: ParseDictionaryOptions = {
    commentCharacter: LINE_COMMENT,
    optionalCompoundCharacter: OPTIONAL_COMPOUND_FIX,
    compoundCharacter: COMPOUND_FIX,
    forbiddenPrefix: FORBID_PREFIX,
    caseInsensitivePrefix: CASE_INSENSITIVE_PREFIX,
};

export const defaultParseDictionaryOptions: ParseDictionaryOptions = Object.freeze(_defaultOptions);

/**
 * Normalizes a dictionary words based upon prefix / suffixes.
 * Case insensitive versions are also generated.
 * @param lines - one word per line
 * @param options - defines prefixes used when parsing lines.
 * @returns words that have been normalized.
 */
export function parseDictionaryLines(
    lines: Iterable<string>,
    options: ParseDictionaryOptions = _defaultOptions
): Iterable<string> {
    const {
        commentCharacter,
        optionalCompoundCharacter: optionalCompound,
        compoundCharacter: compound,
        caseInsensitivePrefix: ignoreCase,
        forbiddenPrefix: forbidden,
    } = options;

    const regexComment = new RegExp(escapeRegEx(commentCharacter) + '.*', 'g');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function isString(line: any | string): line is string {
        return typeof line === 'string';
    }

    function trim(line: string): string {
        return line.trim();
    }

    function removeComments(line: string): string {
        return line.replace(regexComment, '').trim();
    }

    function filterEmptyLines(line: string): boolean {
        return !!line;
    }

    function* mapOptionalPrefix(line: string) {
        if (line[0] === optionalCompound) {
            const t = line.slice(1);
            yield t;
            yield compound + t;
        } else {
            yield line;
        }
    }

    function* mapOptionalSuffix(line: string) {
        if (line.slice(-1) === optionalCompound) {
            const t = line.slice(0, -1);
            yield t;
            yield t + compound;
        } else {
            yield line;
        }
    }

    const doNotNormalizePrefix = new Set([forbidden, ignoreCase]);

    function removeDoublePrefix(w: string): string {
        return w.startsWith(ignoreCase + ignoreCase) ? w.slice(1) : w;
    }

    function* mapNormalize(word: string) {
        word = normalizeWord(word);
        const forms = new Set<string>();
        forms.add(word);
        if (!doNotNormalizePrefix.has(word[0])) {
            for (const n of normalizeWordForCaseInsensitive(word)) {
                if (n !== word) forms.add(ignoreCase + n);
            }
        }
        yield* forms;
    }

    const processLines = operators.pipe(
        operators.filter(isString),
        operators.map(removeComments),
        operators.map(trim),
        operators.filter(filterEmptyLines),
        operators.concatMap(mapOptionalPrefix),
        operators.concatMap(mapOptionalSuffix),
        operators.concatMap(mapNormalize),
        operators.map(removeDoublePrefix)
    );

    return processLines(lines);
}

export function parseLinesToDictionary(
    lines: Iterable<string>,
    options: ParseDictionaryOptions = _defaultOptions
): Trie {
    const dictLines = parseDictionaryLines(lines, options);
    return buildTrieFast([...new Set(dictLines)].sort(), {
        compoundCharacter: options.compoundCharacter,
        forbiddenWordPrefix: options.forbiddenPrefix,
        stripCaseAndAccentsPrefix: options.caseInsensitivePrefix,
    });
}

export function parseDictionary(text: string, options?: ParseDictionaryOptions): Trie {
    return parseLinesToDictionary(text.split('\n'), options);
}

function escapeRegEx(s: string) {
    return s.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}