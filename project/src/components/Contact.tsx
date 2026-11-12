import React, { useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import SectionTilte from './sectionTitle';
import { TextFade } from '../effects/TextFade';

const Contact: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [website, setWebsite] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        setSent(false);
        try {
            const response = await fetch('/api/contact', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message, website }), signal: AbortSignal.timeout(15000),
            });
            const result = await response.json();
            if (!response.ok || result.sent !== true) throw new Error(result.error || 'Não foi possível enviar a mensagem.');
            setName(''); setEmail(''); setMessage(''); setWebsite(''); setSent(true);
        } catch (sendError) {
            setError(sendError instanceof Error && sendError.name !== 'TimeoutError' ? sendError.message : 'O envio demorou demasiado. Tente novamente mais tarde.');
        } finally { setBusy(false); }
    }

    return (
        <section className='h-auto flex flex-col bg-sky-500/35 rounded-4xl pt-0 pb-10' id='contact' aria-labelledby='contact-heading'>
            <SectionTilte titleText="Contato" id="contact-heading" />

            <div className='mx-auto my-10 flex w-full max-w-6xl flex-col gap-8 px-4 lg:flex-row lg:items-start'>
              
                <div className='flex-1/3 text-center lg:text-right flex flex-col mx-10 justify-center'>
                    <TextFade direction="up">
                    <h3 className='mb-7 text-xl font-bold leading-tight md:text-2xl lg:text-3xl'>Quer trazer a energia contagiante da Sardinhas Nômades para o seu evento?</h3>
                    <p className='mb-4 text-base font-(family-name:--font1family) sm:text-lg md:text-xl'>Está ansioso para sentir a batida eletrizante do carnaval brasileiro em Lisboa? Então, entre em contato conosco! Adoramos conhecer novos fãs, fechar parcerias incríveis e levar a nossa festa irreverente para todos os cantos. Preencha o formulário abaixo, mande um e-mail ou nos siga nas redes sociais. Vamos juntos fazer a cidade vibrar com muita música e alegria!</p>
                    </TextFade>
                </div>
                                    <form className='flex-1/3 lg:mt-10 mb-10 min-w-0 text-left' autoComplete="on" onSubmit={(event) => void submit(event)}>
                                        <fieldset disabled={busy} className="min-w-0 border-0 p-0">
                    <label className='ml-2' htmlFor="name">Nome</label>
                    <input className='mt-3 mb-7 min-h-11 w-full rounded-2xl border-2 border-white/50 p-3 text-base' type="text" name="name" id="name" autoComplete="name" placeholder="Seu nome" required maxLength={160} value={name} onChange={(event) => { setName(event.target.value); setSent(false); }} />
                    
                    <label className='ml-2'htmlFor="email">Email</label>
                    <input className='mt-3 mb-7 min-h-11 w-full rounded-2xl border-2 border-white/50 p-3 text-base' type="email" name="email" id="email" autoComplete="email" placeholder="seu@email.com" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setSent(false); }} />
                    
                    <label className='ml-2' htmlFor="message">Mensagem</label>
                    <textarea className='mt-3 mb-7 min-h-48 w-full rounded-2xl border-2 border-white/50 p-3 text-base' name="message" id="message" autoComplete="off" placeholder="Escreva aqui sua mensagem para o cardume!" required maxLength={4000} value={message} onChange={(event) => { setMessage(event.target.value); setSent(false); }}></textarea>
                    <div className="hidden" aria-hidden="true"><label htmlFor="contact-website">Website</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
                    
                    <button style={{ margin: 0 }} className='inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-4xl border-2 border-white/50 p-3 px-6 text-lg font-bold text-white transition-colors hover:bg-yellow-500 disabled:cursor-wait disabled:opacity-60' type="submit" disabled={busy}><Send size={20} />{busy ? 'A enviar...' : 'Enviar'}</button>
                    </fieldset>
                    {error && <p role="alert" className="mt-4 wrap-break-word rounded border border-red-300 bg-red-950 p-3 text-sm text-white">{error}</p>}
                    {sent && <p role="status" className="mt-4 text-sm">Mensagem enviada. Obrigado pelo contato!</p>}
                </form>

            </div>
        </section>
    );
};

export default Contact;