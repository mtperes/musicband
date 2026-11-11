import React from 'react';
import SectionTilte from './sectionTitle';
import { TextFade } from '../effects/TextFade';

const Contact: React.FC = () => {
    return (
        <section className='h-auto flex flex-col bg-sky-500/35 rounded-4xl pt-0 pb-10' id='contact' aria-labelledby='contact-heading'>
            <SectionTilte titleText="Contato" id="contact-heading" />

            <div className='lg:flex gap-4 justify-center items-center lg:mx-70 my-10  px-4'>
              
                <div className='flex-1/3 text-center lg:text-right flex flex-col mx-10 justify-center'>
                    <TextFade direction="up">
                    <h3 className='mb-7 text-xl font-bold leading-tight md:text-2xl lg:text-3xl'>Quer trazer a energia contagiante da Sardinhas Nômades para o seu evento?</h3>
                    <p className='mb-4 text-base font-(family-name:--font1family) sm:text-lg md:text-xl'>Está ansioso para sentir a batida eletrizante do carnaval brasileiro em Lisboa? Então, entre em contato conosco! Adoramos conhecer novos fãs, fechar parcerias incríveis e levar a nossa festa irreverente para todos os cantos. Preencha o formulário abaixo, mande um e-mail ou nos siga nas redes sociais. Vamos juntos fazer a cidade vibrar com muita música e alegria!</p>
                    </TextFade>
                </div>
                                    <form className='flex-1/3 lg:mt-10 mb-10 text-left' autoComplete="on">
                                        <p className="mb-4 text-sm" role="status">O envio online será ativado após a configuração do serviço de e-mail.</p>
                                        <fieldset disabled className="min-w-0 border-0 p-0">
                    <label className='ml-2' htmlFor="name">Nome</label>
                    <input className='mt-3 mb-7 min-h-11 w-full rounded-2xl border-2 border-white/50 p-3 text-base' type="text" name="name" id="name" autoComplete="name" placeholder="Seu nome" required />
                    
                    <label className='ml-2'htmlFor="email">Email</label>
                    <input className='mt-3 mb-7 min-h-11 w-full rounded-2xl border-2 border-white/50 p-3 text-base' type="email" name="email" id="email" autoComplete="email" placeholder="seu@email.com" required />
                    
                    <label className='ml-2' htmlFor="message">Mensagem</label>
                    <textarea className='mt-3 mb-7 min-h-[12rem] w-full rounded-2xl border-2 border-white/50 p-3 text-base' name="message" id="message" autoComplete="off" placeholder="Escreva aqui sua mensagem para o cardume!" required></textarea>
                    
                    <button className='min-h-11 w-full rounded-4xl border-2 border-white/50 p-3 px-6 font-bold text-white transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60' type="submit">Enviar</button>
                    </fieldset>
                </form>

            </div>
        </section>
    );
};

export default Contact;