import React from "react";
import backgroundVideo from "@assets/Untitled design (22)_1752822331413.mp4";

export default function PrivacyPage() {
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
						Privacy Policy
					</h1>

					<h2 className="text-2xl sm:text-3xl font-semibold mb-3">KILT Foundation Liquidity Portal – Privacy Policy</h2>
					<p className="text-white/80 text-lg sm:text-xl mb-8">Effective Date: August 11, 2025</p>

					<div className="space-y-8 text-white/90 text-lg sm:text-xl">
						<section>
							<p>
								The KILT Foundation ("we," "us," or "our") operates the Liquidity Portal at <a href="https://liq.kilt.io" className="underline">liq.kilt.io</a> (the "Portal"). This policy explains how we collect, use, store, and protect your information when using the Portal, including during beta testing.
							</p>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">1. Information We Collect</h3>
							<p className="mb-3">We collect information to run the Portal and administer programs.</p>
							<h4 className="text-xl font-semibold mb-2">1.1 Information You Provide Directly</h4>
							<ul className="list-disc pl-6 space-y-1">
								<li>Telegram handle (for contact and group access)</li>
								<li>Wallet addresses on Base (whitelisting, rewards distribution)</li>
								<li>Estimated liquidity amount in USD</li>
								<li>Contact information (email or Telegram) for support or updates</li>
								<li>Optional feedback or survey responses</li>
							</ul>
							<h4 className="text-xl font-semibold mt-4 mb-2">1.2 Information Collected Automatically</h4>
							<ul className="list-disc pl-6 space-y-1">
								<li>Technical data: IP, browser, device, OS</li>
								<li>Usage data: pages visited, features used, time on Portal, liquidity actions</li>
								<li>Blockchain data: public on-chain activity linked to your wallet</li>
							</ul>
							<h4 className="text-xl font-semibold mt-4 mb-2">1.3 Information from Third Parties</h4>
							<ul className="list-disc pl-6 space-y-1">
								<li>Blockchain analytics to assess liquidity activity and rewards</li>
								<li>Participation info from communication platforms (e.g., Telegram)</li>
							</ul>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">2. How We Use Your Information</h3>
							<ul className="list-disc pl-6 space-y-1">
								<li>Facilitate participation, whitelisting, and rewards administration</li>
								<li>Communicate updates, instructions, and support</li>
								<li>Improve the Portal and analyze usage</li>
								<li>Security, fraud prevention, and legal compliance</li>
								<li>Aggregate analytics for trends and performance</li>
							</ul>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">3. Sharing</h3>
							<ul className="list-disc pl-6 space-y-1">
								<li>Service providers under contract (analytics, storage, communications)</li>
								<li>Authorized KILT Foundation personnel and contractors</li>
								<li>Blockchain networks (public transactions linked to your wallet)</li>
								<li>Legal compliance and protection of rights</li>
							</ul>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">4. Security</h3>
							<p>We use reasonable technical and organizational measures (encryption, access controls, assessments). Blockchain activity is public. Secure your wallet and private keys.</p>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">5. Retention</h3>
							<ul className="list-disc pl-6 space-y-1">
								<li>Beta testing data: retained for program duration and up to 6 months after</li>
								<li>Portal usage data: retained as needed for rewards, compliance, and analytics</li>
								<li>Anonymized/aggregated data may be retained indefinitely</li>
							</ul>
							<p className="mt-2">Delete requests: <a href="mailto:hello@kilt.io" className="underline">hello@kilt.io</a></p>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">6. Your Rights</h3>
							<p>Depending on your jurisdiction, you may request access, correction, deletion, restriction, portability, or object to processing. Contact us to exercise rights.</p>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">7. International Transfers</h3>
							<p>Data may be processed outside your country. We apply appropriate safeguards when required.</p>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">8. Cookies and Tracking</h3>
							<p>We may use cookies or similar technologies for functionality and analytics. You can control cookies via your browser settings.</p>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">9. Third‑Party Links</h3>
							<p>External sites have their own policies. Review before providing information.</p>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">10. Children’s Privacy</h3>
							<p>The Portal is not intended for individuals under 18. If we learn of data from a minor, we will delete it.</p>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">11. Changes</h3>
							<p>We may update this policy and will post the revised version on the Portal with a new effective date.</p>
						</section>

						<section>
							<h3 className="text-2xl font-semibold mb-3">12. Contact</h3>
							<p>Questions or rights requests: <a href="mailto:hello@kilt.io" className="underline">hello@kilt.io</a></p>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
