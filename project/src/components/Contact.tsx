import React from 'react';
import SectionTilte from './sectionTitle';



const Contact: React.FC = () => {
    return (
        <section className='h-screen flex-col  bg-sky-500/55 p-4 rounded-[30px]' id='contact'>

            <SectionTilte titleText="Contato" />

            <div className=' flex gap-4  justify-center items-center w-80 m-auto    '>
            <form className='flex-1/2'  action=""
            >
                <label htmlFor="name">Nome</label>
              <input className='input border-white-50 border-2 w-90' type="text" name="" id="" />
                <label htmlFor="email">Email</label>
              <input className='input border-white-50 border-2 w-90' type="email" name="" id="" />
                <label htmlFor="message">Mensagem</label>
            <textarea className='input border-white-50 border-2 w-90' name="message" id=""></textarea>
              <button className='button' type="submit">Send</button>
            </form>

                <div className='flex-1/2 text-center md:text-left '>
                    <h2 className='text-2xl mb-4'>Quer trazer a energia contagiante da Sardinhas Nômades para o seu evento?</h2>
                    <p className='mb-2 font-(family-name:--font1family)  '> Está ansioso para sentir a batida eletrizante do carnaval brasileiro em Lisboa? Então, entre em contato conosco! Adoramos conhecer novos fãs, fechar parcerias incríveis e levar a nossa festa irreverente para todos os cantos. Preencha o formulário abaixo, mande um e-mail ou nos siga nas redes sociais. Vamos juntos fazer a cidade vibrar com muita música e alegria! </p>
                    
                </div>
            </div>
           
        </section>
    );
};

export default Contact;