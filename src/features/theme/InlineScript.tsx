/**
 * A script that runs during HTML parsing (server render) but isn't re-created on the
 * client, which React warns about. Pattern from Next's "preventing flash" guide.
 */
export function InlineScript({ html }: { html: string }) {
    return (
        <script
            type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
