import React from 'react';
import SectionTilte from './sectionTitle';
import { TextFade } from '../effects/TextFade';

const Contact: React.FC = () => {
    return (
        <section className='h-auto flex flex-col bg-sky-500/35 rounded-4xl pt-0 pb-10' id='contact'>
            <SectionTilte titleText="Contato" />

            <div className='lg:flex gap-4 justify-center items-center lg:mx-70 my-10  px-4'>
              
                <div className='flex-1/3 text-center lg:text-right flex flex-col mx-10 justify-center'>
                    <TextFade direction="up">
                    <h2 className='text-xl md:text-2xl lg:text-3xl font-bold mb-7 leading-tight'>Quer trazer a energia contagiante da Sardinhas Nômades para o seu evento?</h2>
                    <p className=' text-2xl  mb-4 font-(family-name:--font1family)'>Está ansioso para sentir a batida eletrizante do carnaval brasileiro em Lisboa? Então, entre em contato conosco! Adoramos conhecer novos fãs, fechar parcerias incríveis e levar a nossa festa irreverente para todos os cantos. Preencha o formulário abaixo, mande um e-mail ou nos siga nas redes sociais. Vamos juntos fazer a cidade vibrar com muita música e alegria!</p>
                    </TextFade>
                </div>
                  <form className='flex-1/3 lg:mt-10 mb-10 text-left' action="" autoComplete="on">
                    <label className='ml-2' htmlFor="name">Nome</label>
                    <input className='p-3 border-white-50 border-2 w-full mb-7 mt-4 rounded-2xl' type="text" name="name" id="name" placeholder="Seu nome" required />
                    
                    <label className='ml-2'htmlFor="email">Email</label>
                    <input className='p-3 border-white-50 border-2 w-full mb-7 mt-4 rounded-2xl' type="email" name="email" id="email" placeholder="seu@email.com" required />
                    
                    <label className='ml-2' htmlFor="message">Mensagem</label>
                    <textarea className='p-3 border-white-50 border-2 w-full mb-7 mt-4 rounded-2xl min-h-[200px]' name="message" id="message" placeholder="Escreva aqui sua mensagem para o cardume!" required></textarea>
                    
                    <button className=' text-white border-white-50 border-2 rounded-4xl font-bold p-3 px-6 w-full hover:bg-yellow-500 transition-colors' type="submit">Enviar</button>
                </form>

            </div>
        </section>
    );
};

export default Contact;