import React from "react";
import backgroundVideo from "@assets/Untitled design (22)_1752822331413.mp4";

export default function TermsPage() {
	return (
		<div className="min-h-screen text-white overflow-x-hidden relative">
			{/* Background video to match main dashboard */}
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
			{/* Readability overlay */}
			<div className="absolute inset-0 bg-black/30" style={{ zIndex: 2 }}></div>

			<div className="relative" style={{ zIndex: 10 }}>
				<div className="max-w-7xl mx-auto px-4 pt-12 pb-28">
					<h1 className="leading-none mb-10 font-extrabold text-white text-[12vw] sm:text-6xl lg:text-7xl tracking-tight">Terms & Conditions</h1>
					<div className="space-y-8 text-white/90 text-lg sm:text-xl">
						<h2 className="text-2xl sm:text-3xl font-semibold mb-3">KILT Foundation Liquidity Portal Beta Testing Program – Terms and Conditions</h2>
						<p><strong>Effective Date: August 11, 2025</strong></p>
						<p>
							These Terms and Conditions (“Terms”) govern your participation in the KILT Foundation Liquidity Portal Beta Testing Program (the “Beta Program”) at <a href="https://liq.kilt.io" className="underline">liq.kilt.io</a> (the “Portal”). By applying to or participating in the Beta Program, you (“you” or “Participant”) agree to be bound by these Terms, the KILT Foundation’s Privacy Policy, and any additional rules or instructions provided by the KILT Foundation (“we,” “us,” or “our”). If you do not agree to these Terms, do not apply or participate.
						</p>
						<h3 className="text-2xl font-semibold mb-3">1. Overview of the Beta Program</h3>
						<p>
							The Beta Program is a 14-day testing period for the KILT Foundation’s Liquidity Portal, a platform enabling users to provide liquidity for the KILT token in a Uniswap pool on the Base network and earn rewards in $KILT based on factors such as liquidity composition, position range, duration, and loyalty. The Beta Program is designed to test the Portal’s functionality and reward system using real liquidity and real rewards. Participation is by invitation only, and successful applicants will be whitelisted to interact with the Portal.
						</p>
						<h3 className="text-2xl font-semibold mb-3">2. Eligibility</h3>
						<p>To participate in the Beta Program, you must:</p>
						<ul className="list-disc pl-6 space-y-1">
							<li>Be at least 18 years old and have the legal capacity to enter into these Terms.</li>
							<li>Hold KILT tokens (contract address: 0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8) and ETH on the Base network.</li>
							<li>Have basic familiarity with cryptocurrency wallets, transaction signing, and liquidity provision.</li>
							<li>Submit a complete application via the provided form, including your Telegram handle, Base wallet address(es), and estimated liquidity amount.</li>
							<li>Be approved and whitelisted by the KILT Foundation. Our decision on participant selection is final and not subject to appeal.</li>
							<li>Not be located in, or a resident of, any jurisdiction where participation in the Beta Program or use of the Portal is prohibited by law (due to cryptocurrency or sanctions regulations).</li>
						</ul>
						<h3 className="text-2xl font-semibold mb-3">3. Participation Requirements</h3>
						<p>As a Participant, you agree to:</p>
						<ul className="list-disc pl-6 space-y-1">
							<li>Provide accurate and complete information in your application, including valid Base wallet address(es) for whitelisting.</li>
							<li>Use only whitelisted wallet addresses for liquidity provision during the Beta Program.</li>
							<li>Explore different liquidity positions (full-range or concentrated) and, if possible, use multiple wallets, as encouraged by the program.</li>
							<li>Follow all instructions provided by the KILT Foundation, including those shared via email (<a href="mailto:hello@kilt.io" className="underline">hello@kilt.io</a>), Telegram, or the Portal.</li>
							<li>Comply with these Terms and all applicable laws, including tax and cryptocurrency regulations in your jurisdiction.</li>
						</ul>
						<p>You are solely responsible for:</p>
						<ul className="list-disc pl-6 space-y-1">
							<li>Securing your wallet(s) and private keys. The KILT Foundation is not liable for losses due to compromised wallets.</li>
							<li>Ensuring you have sufficient KILT and ETH to participate and cover transaction fees (gas fees on the Base network).</li>
							<li>Understanding the risks of liquidity provision, including impermanent loss, market volatility, and smart contract vulnerabilities.</li>
						</ul>
						<h3 className="text-2xl font-semibold mb-3">4. Rewards</h3>
						<ul className="list-disc pl-6 space-y-1">
							<li><strong>Reward Structure:</strong> Participants may earn $KILT rewards based on factors such as liquidity composition (proportion of ETH and KILT), position type (full-range or concentrated), time spent in or out of range, and duration of participation. Specific reward calculations will be provided before the Beta Program begins.</li>
							<li><strong>Distribution:</strong> Rewards will be distributed to whitelisted wallet addresses at the end of the 14-day Beta Program, subject to our discretion and verification of compliance with these Terms.</li>
							<li><strong>No Guarantee:</strong> Rewards are not guaranteed and depend on your participation, pool performance, and Portal functionality. We reserve the right to modify or cancel the reward system at any time without liability.</li>
							<li><strong>Tax Responsibility:</strong> You are responsible for reporting and paying any taxes associated with rewards, in accordance with applicable laws.</li>
						</ul>
						<h3 className="text-2xl font-semibold mb-3">5. Risks of Participation</h3>
						<p>The Beta Program and Portal are in a testing phase and involve significant risks, including but not limited to:</p>
						<ul className="list-disc pl-6 space-y-1">
							<li><strong>Financial Risks:</strong> Liquidity provision may result in impermanent loss, market losses due to volatility, or loss of funds due to smart contract vulnerabilities or hacks.</li>
							<li><strong>Technical Risks:</strong> The Portal is in beta and may contain bugs, errors, or downtime that could affect functionality or lead to loss of funds.</li>
							<li><strong>Blockchain Risks:</strong> Transactions on the Base network are irreversible and public. Errors in wallet addresses or transactions are your responsibility.</li>
							<li><strong>Regulatory Risks:</strong> Cryptocurrency regulations vary by jurisdiction, and participation may have legal or tax implications.</li>
						</ul>
						<p>By participating, you acknowledge these risks and agree that the KILT Foundation is not liable for any losses, damages, or adverse outcomes resulting from your participation.</p>
						<h3 className="text-2xl font-semibold mb-3">6. Intellectual Property</h3>
						<ul className="list-disc pl-6 space-y-1">
							<li>The Portal, including its design, code, and content, is owned by the KILT Foundation or its licensors and is protected by intellectual property laws.</li>
							<li>You are granted a limited, non-exclusive, non-transferable license to use the Portal for the Beta Program, subject to these Terms.</li>
							<li>You may not copy, modify, distribute, reverse-engineer, or otherwise exploit the Portal or its code without our written permission.</li>
						</ul>
						<h3 className="text-2xl font-semibold mb-3">7. Prohibited Conduct</h3>
						<p>You agree not to:</p>
						<ul className="list-disc pl-6 space-y-1">
							<li>Attempt to exploit, hack, or manipulate the Portal, its smart contracts, or the reward system.</li>
							<li>Provide false or misleading information in your application or during participation.</li>
							<li>Use the Portal for illegal purposes, including money laundering or violating sanctions.</li>
							<li>Share access to the Portal or your whitelisted wallet(s) with others.</li>
							<li>Interfere with other Participants’ use of the Portal or the Beta Program.</li>
						</ul>
						<p>We reserve the right to disqualify you from the Beta Program and revoke access to the Portal for any violation of these Terms, without notice or liability.</p>
						<h3 className="text-2xl font-semibold mb-3">8. Termination</h3>
						<ul className="list-disc pl-6 space-y-1">
							<li><strong>By You:</strong> You may withdraw from the Beta Program at any time by ceasing to use the Portal.</li>
							<li><strong>By Us:</strong> We may terminate your participation at our sole discretion, including for violating these Terms, suspected fraud, or technical issues with the Portal.</li>
							<li>Upon termination, you will no longer be eligible for rewards, and any pending rewards may be forfeited. Termination does not affect your obligations under these Terms.</li>
						</ul>
						<h3 className="text-2xl font-semibold mb-3">9. Limitation of Liability</h3>
						<p>To the maximum extent permitted by law:</p>
						<ul className="list-disc pl-6 space-y-1">
							<li>The KILT Foundation, its affiliates, and their respective officers, employees, or contractors are not liable for any direct, indirect, incidental, consequential, or other damages arising from your participation in the Beta Program or use of the Portal, including loss of funds, data breaches, or technical failures.</li>
							<li>The Portal is provided “as is” without warranties of any kind, express or implied, including warranties of fitness for a particular purpose or non-infringement.</li>
							<li>We do not guarantee the availability, accuracy, or security of the Portal or the Base network.</li>
						</ul>
						<h3 className="text-2xl font-semibold mb-3">10. Indemnification</h3>
						<p>You agree to indemnify and hold harmless the KILT Foundation, its affiliates, and their respective officers, employees, or contractors from any claims, losses, or damages (including legal fees) arising from your participation in the Beta Program, violation of these Terms, or misuse of the Portal.</p>
						<h3 className="text-2xl font-semibold mb-3">11. Governing Law and Dispute Resolution</h3>
						<ul className="list-disc pl-6 space-y-1">
							<li><strong>Governing Law:</strong> These Terms are governed by the laws of the Cayman Islands, without regard to conflict of law principles.</li>
							<li><strong>Dispute Resolution:</strong> Any disputes arising from these Terms or the Beta Program will be resolved through binding arbitration in the Cayman Islands, conducted by Cayman International Mediation and Arbitration Centre CI-MAC under its rules. You waive the right to participate in class actions or collective arbitration.</li>
						</ul>
						<h3 className="text-2xl font-semibold mb-3">12. Modifications to the Terms</h3>
						<p>We may update these Terms at any time by posting the revised version on <a href="https://liq.kilt.io" className="underline">liq.kilt.io</a> with a new effective date. Continued participation in the Beta Program after such changes constitutes your acceptance of the updated Terms.</p>
						<h3 className="text-2xl font-semibold mb-3">13. Miscellaneous</h3>
						<ul className="list-disc pl-6 space-y-1">
							<li><strong>Entire Agreement:</strong> These Terms, the Privacy Policy, and any instructions provided by the KILT Foundation constitute the entire agreement between you and us regarding the Beta Program.</li>
							<li><strong>Severability:</strong> If any provision of these Terms is found invalid or unenforceable, the remaining provisions will remain in effect.</li>
							<li><strong>Assignment:</strong> You may not assign your rights or obligations under these Terms without our written consent. We may assign these Terms at our discretion.</li>
							<li><strong>No Waiver:</strong> Our failure to enforce any provision of these Terms does not constitute a waiver of that provision.</li>
						</ul>
						<h3 className="text-2xl font-semibold mb-3">14. Contact Us</h3>
						<p>For questions about these Terms or the Beta Program, contact us at:</p>
						<ul className="list-disc pl-6 space-y-1">
							<li><strong>Email:</strong> <a href="mailto:hello@kilt.io" className="underline">hello@kilt.io</a></li>
							<li><strong>Website:</strong> <a href="https://liq.kilt.io" className="underline">liq.kilt.io</a></li>
						</ul>
						<p>
							By submitting an application or participating in the Beta Program, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions and the KILT Foundation’s Privacy Policy.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
