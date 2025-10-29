import React from "react";
import backgroundVideo from "@assets/Untitled design (22)_1752822331413.mp4";

export default function DisclaimerPage() {
	return (
		<div className="min-h-screen text-white overflow-x-hidden relative">
			<video
				autoPlay
				muted
				loop
				playsInline
				preload="auto"
				className="fixed top-0 left-0 w-full h-full object-cover"
				style={{ zIndex: 1 }}
			>
				<source src={backgroundVideo} type="video/mp4" />
			</video>
			<div className="absolute inset-0 bg-black/30" style={{ zIndex: 2 }}></div>

			<div className="relative" style={{ zIndex: 10 }}>
				<div className="max-w-7xl mx-auto px-4 pt-12 pb-28">
					<h1 className="leading-none mb-10 font-extrabold text-white text-[12vw] sm:text-6xl lg:text-7xl tracking-tight">
						Disclaimer
					</h1>

					<div className="space-y-6 text-white/90 text-lg sm:text-xl">
						<p>
							Under no circumstances should any posts, materials, or other information provided on this website—or through related content distribution channels—be interpreted as an offer to buy or sell any security or interest by KILT Foundation personnel. Likewise, nothing contained herein should be considered an offer to provide investment advisory services.
						</p>
						<p>
							The content available on this site, as well as any associated distribution platforms, public KILT Foundation social media accounts, or other online channels (collectively referred to as "content distribution outlets"), should not be regarded or relied upon as investment, legal, tax, or financial advice. You should consult your own professional advisors before making any investment decisions. Any forward‑looking statements, projections, estimates, or opinions expressed may change at any time without notice and may differ from other sources.
						</p>
						<p>
							Any charts or visual data presented here or on KILT Foundation's content distribution outlets are for informational purposes only and should not be considered a basis for investment decisions. Some details may be sourced from third parties and, while believed reliable, have not been independently verified by KILT Foundation.
						</p>
						<p>
							Additionally, posts may feature third‑party advertisements. KILT Foundation has not reviewed such advertisements and does not endorse any advertising content contained within them. All content reflects the date it was published and may not be updated.
						</p>

						<h3 className="text-2xl font-semibold mt-8">Limitation of liability for internal content</h3>
						<p>
							The content of our website has been compiled with care and to the best of our knowledge. However, we cannot assume any liability for the up‑to‑dateness, completeness or accuracy of any pages. As service providers we are liable for our own content in accordance with general laws, but are not obliged to monitor external information provided or stored on our website. Upon becoming aware of a specific infringement, we will remove the content immediately.
						</p>

						<h3 className="text-2xl font-semibold mt-8">Limitation of liability for external links</h3>
						<p>
							Our website contains links to third‑party websites ("external links"). As the content of these websites is not under our control, we cannot assume liability for such external content. The provider of the linked websites is responsible for the content and accuracy of the information. When the links were placed, no infringements were recognizable. On notice of any infringement, we will remove the link immediately.
						</p>

						<h3 className="text-2xl font-semibold mt-8">Copyright</h3>
						<p>
							Content and works on this website are governed by the copyright laws of the Cayman Islands. Any duplication, processing, distribution or utilization beyond copyright law requires prior written consent of the respective author(s).
						</p>

						<h3 className="text-2xl font-semibold mt-8">Data protection</h3>
						<p>
							A visit to our website can store access information (date, time, page accessed). This does not represent analysis of personal data. If personal data are collected, this only occurs with prior consent. Any forwarding to third parties without express consent will not take place. Transmission of data via the Internet (e.g., email) can offer security vulnerabilities; complete protection against third‑party access is not possible.
						</p>

						<p>
							The use by third parties of published contact details for advertising is expressly excluded. We reserve the right to take legal steps in the case of unsolicited advertising information (e.g., spam).
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
