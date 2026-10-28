<script lang="ts">
	import { asset, resolve } from '$app/paths';

	// A real result, quoted word for word: Species at Risk Act (S.C. 2002, c. 29), section 2,
	// PDF page 12 as published on the Justice Laws Website and indexed by the engine.
	const pdf = 'https://laws-lois.justice.gc.ca/PDF/S-15.3.pdf#page=12';
</script>

<svelte:head>
	<title>Boreal Search</title>
	<meta
		name="description"
		content="Boreal searches large sets of PDFs and returns the pages that answer the question, each opened at the right page, with a generated summary checked sentence by sentence against its cited pages."
	/>
</svelte:head>

<header class="hero">
	<p class="eyebrow">Search for environmental assessment and regulatory documents</p>
	<h1>Species at Risk Act, s.&nbsp;2, p.&nbsp;12.</h1>
	<p class="lede">
		That's where the Act defines critical habitat. Boreal searches large sets of PDFs and returns
		the pages that answer the question, each one opened at the right page.
	</p>
	<div class="actions">
		<a class="button primary" href={resolve('/signup')}>Sign up</a>
		<a class="button" href={resolve('/login')}>Log in</a>
	</div>
</header>

<section class="proof" aria-label="Example result">
	<a class="sheet" href={pdf} rel="external">
		<span class="frame">
			<img
				src={asset('splash/sara-p12.webp')}
				width="935"
				height="1210"
				alt="Page 12 of the Species at Risk Act, section 2 definitions in English and French, with the definition of critical habitat outlined"
			/>
			<span class="mark" aria-hidden="true"></span>
		</span>
	</a>

	<div class="passage">
		<p class="readout">
			<span>search <b>definition of critical habitat</b></span>
			<span>result <b>1</b></span>
			<span><b>554</b> pages searched in <b>3</b> Acts</span>
		</p>
		<blockquote class="source">
			<p>
				<b>critical habitat</b> means the habitat that is necessary for the survival or recovery of a
				listed wildlife species and that is identified as the species’ critical habitat in the recovery
				strategy or in an action plan for the species.
			</p>
		</blockquote>
		<a class="loc" href={pdf} rel="external">Species at Risk Act · s.2 · p.12</a>
	</div>
</section>

<section class="band" aria-labelledby="how-h">
	<h2 id="how-h">How it works</h2>
	<ol class="rows">
		<li>
			<span class="key">Search</span>
			<span
				>Type a question in plain words. Boreal searches every page of every PDF in the set.</span
			>
		</li>
		<li>
			<span class="key">Pages</span>
			<span
				>Results are pages, ranked, each shown as filed beside the passage that matched. A locator
				opens the PDF at that page.</span
			>
		</li>
		<li>
			<span class="key">Generated summary</span>
			<span
				>A short summary, labelled as generated. Each sentence cites a page and is checked against
				it; one the page doesn't support is marked. When nothing answers the question, it says "Not
				found in the pages searched."</span
			>
		</li>
	</ol>
</section>

<section class="band" aria-labelledby="who-h">
	<h2 id="who-h">Who it's for</h2>
	<p>
		For people who work through thousands of pages of applications, filings and legislation and cite
		them by page: environmental assessment consultants, regulatory reviewers and counsel, among
		others.
	</p>
</section>

<section class="band" aria-labelledby="access-h">
	<h2 id="access-h">What you can search</h2>
	<ol class="rows">
		<li>
			<span class="key">Now</span>
			<span
				>Sign up to search the federal environmental Acts: the Canadian Environmental Protection
				Act, 1999, the Impact Assessment Act and the Species at Risk Act.</span
			>
		</li>
		<li>
			<span class="key">Your documents</span>
			<span>Once you've signed up, request access to search your organization's documents.</span>
		</li>
	</ol>
	<div class="actions">
		<a class="button primary" href={resolve('/signup')}>Sign up</a>
		<a class="button" href={resolve('/login')}>Log in</a>
	</div>
</section>

<style>
	.hero {
		display: grid;
		gap: 1.25rem;
		padding-block: 1.5rem 2.5rem;
	}
	.eyebrow {
		margin: 0;
		font: 500 0.8125rem/1.5 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	h1 {
		margin: 0;
		font-size: clamp(2.5rem, 8vw, 5.5rem);
		line-height: 0.98;
		letter-spacing: -0.035em;
	}
	.lede {
		margin: 0;
		max-width: 52ch;
		font-size: 1.25rem;
		line-height: 1.5;
	}

	/* The passage beside the page it came from, under a heavier rule. */
	.proof {
		display: grid;
		grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
		gap: 1.5rem 3rem;
		align-items: center;
		padding-block: 2rem 3rem;
		border-top: 1px solid var(--color-ink);
	}
	.frame {
		display: block;
		position: relative;
	}
	/* The definition's place on the page (image coordinates), outlined as the results view does. */
	.mark {
		position: absolute;
		left: 7%;
		top: 22.4%;
		width: 42%;
		height: 7.8%;
		pointer-events: none;
		background: var(--color-sheet-mark);
		mix-blend-mode: multiply;
		outline: 1.5px solid var(--color-sheet-mark-verified);
		outline-offset: 0;
		border-radius: 2px;
	}
	.passage {
		display: grid;
		gap: 1rem;
		align-content: center;
	}
	.passage blockquote {
		margin: 0;
		font-size: clamp(1.25rem, 2.4vw, 1.5rem);
		line-height: 1.5;
	}
	.passage blockquote p {
		margin: 0;
	}
	.passage blockquote b {
		font-weight: 600;
	}
	.passage .loc {
		justify-self: start;
	}

	.band h2 {
		margin-bottom: 1rem;
	}
	.rows {
		margin: 0 0 1.5rem;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--color-rule);
	}
	.rows li {
		display: grid;
		grid-template-columns: minmax(0, 12rem) minmax(0, 1fr);
		gap: 0.25rem 1.5rem;
		padding-block: 0.75rem;
		border-bottom: 1px solid var(--color-rule);
	}
	.rows:last-child {
		margin-bottom: 0;
	}
	.rows li > :last-child {
		max-width: 68ch;
	}
	.key {
		font-weight: 600;
	}
	.band > p {
		margin-bottom: 0;
	}

	@media (max-width: 40rem) {
		.proof {
			grid-template-columns: minmax(0, 1fr);
		}
		.proof .sheet {
			max-width: 22rem;
		}
		.rows li {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
