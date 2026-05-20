import React from 'react';
import SectionTilte from './sectionTitle';

const Contact: React.FC = () => {
    return (
        <section className='h-screen flex flex-col bg-sky-500/55 rounded-4xl pt-0' id='contact'>
            <SectionTilte titleText="Contato" />

            <div className='lg:flex gap-4 justify-center items-center lg:mx-40 px-4'>
              
                <div className='flex-2/3 text-center md:text-left flex flex-col justify-center'>
                    <h2 className='text-xl md:text-2xl lg:text-3xl font-bold mb-4 leading-tight'>Quer trazer a energia contagiante da Sardinhas Nômades para o seu evento?</h2>
                    <p className='text-base md:text-lg mb-4 leading-relaxed text-white/90'>Está ansioso para sentir a batida eletrizante do carnaval brasileiro em Lisboa? Então, entre em contato conosco! Adoramos conhecer novos fãs, fechar parcerias incríveis e levar a nossa festa irreverente para todos os cantos. Preencha o formulário abaixo, mande um e-mail ou nos siga nas redes sociais. Vamos juntos fazer a cidade vibrar com muita música e alegria!</p>
                </div>
                  <form className='flex-1/3' action="" autoComplete="on">
                    <label htmlFor="name">Nome</label>
                    <input className='p-3 border-white-50 border-2 w-full mb-3 rounded-2xl' type="text" name="name" id="name" placeholder="Seu nome" required />
                    
                    <label htmlFor="email">Email</label>
                    <input className='p-3 border-white-50 border-2 w-full mb-3 rounded-2xl' type="email" name="email" id="email" placeholder="seu@email.com" required />
                    
                    <label htmlFor="message">Mensagem</label>
                    <textarea className='p-3 border-white-50 border-2 w-full mb-3 rounded-2xl' name="message" id="message" placeholder="Sua mensagem..." required></textarea>
                    
                    <button className=' text-white font-bold p-3 px-6 rounded-lg w-full hover:bg-yellow-500 transition-colors' type="submit">Enviar</button>
                </form>

            </div>
        </section>
    );
};

export default Contact;